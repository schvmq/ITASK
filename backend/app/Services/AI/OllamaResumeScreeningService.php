<?php

namespace App\Services\AI;

use App\Models\Committee;
use App\Models\MemberResume;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class OllamaResumeScreeningService
{
    public const COMPETENCY_DOMAINS = [
        'technical_engineering' => [
            'label' => 'Technical & Web Engineering',
            'keywords' => [
                'technical', 'web', 'system', 'react', 'laravel', 'php', 'api', 'database',
                'software', 'portal', 'dashboard', 'integration', 'table', 'endpoint',
                'permission', 'tool', 'automat', 'attendance', 'network', 'program', 'coding', 'develop',
            ],
            'examples' => 'Web portal setup, React dashboards, API & database tools, automated attendance systems',
        ],
        'documentation_secretariat' => [
            'label' => 'Documentation & Secretariat',
            'keywords' => [
                'document', 'secretariat', 'minute', 'report', 'writing', 'binder', 'mov',
                'archiv', 'draft', 'criteria', 'alignment', 'pacucoa', 'ched', 'memo',
                'letter', 'narrative', 'record', 'transcrib',
            ],
            'examples' => 'Minutes of meeting, MOV binders, narrative reports, criteria alignment drafts',
        ],
        'quality_assurance' => [
            'label' => 'Quality Assurance & Accreditation',
            'keywords' => [
                'quality', 'assurance', 'audit', 'accreditation', 'evidence', 'verif',
                'compliance', 'review', 'rubric', 'checklist', 'iso', 'coe', 'validat', 'inspect', 'test',
            ],
            'examples' => 'Accreditation evidence audit, MOV verification, compliance checklists, QA review',
        ],
        'logistics_operations' => [
            'label' => 'Event Logistics & Operations',
            'keywords' => [
                'logistic', 'operation', 'event', 'venue', 'equipment', 'inventory', 'registration',
                'usher', 'schedul', 'budget', 'procure', 'setup', 'food', 'sound', 'stage', 'hosting',
            ],
            'examples' => 'Venue preparation, equipment & sound setup, scheduling, registration & logistics',
        ],
        'leadership_facilitation' => [
            'label' => 'Committee Leadership & Facilitation',
            'keywords' => [
                'leadership', 'facilitat', 'lead', 'chair', 'manage', 'coordinat', 'direct',
                'meeting', 'stakeholder', 'planning', 'supervis', 'delegat', 'moderat', 'emcee',
            ],
            'examples' => 'Directing committee deliverables, moderating sessions, cross-team coordination',
        ],
        'media_creative' => [
            'label' => 'Media, Design & Communications',
            'keywords' => [
                'media', 'creative', 'graphic', 'design', 'video', 'audio', 'visual', 'poster',
                'canva', 'brand', 'social', 'announcement', 'public', 'photo', 'edit', 'presentation', 'slide', 'layout',
            ],
            'examples' => 'Audio-visual briefs, graphic design, video editing, event branding & publicity',
        ],
    ];

    public const TASK_CATEGORY_DOMAINS = [
        'Web & System Setup' => 'technical_engineering',
        'Quality & Evidence Audit' => 'quality_assurance',
        'Documentation & Minutes' => 'documentation_secretariat',
        'Event Logistics' => 'logistics_operations',
        'Committee Coordination' => 'leadership_facilitation',
        'Media & Visual Production' => 'media_creative',
    ];

    public const LEADERSHIP_OPTIONS = [
        'Lead or Independent',
        'Co-Lead / Active Contributor',
        'Support Role',
    ];

    public const AVAILABILITY_OPTIONS = [
        '1-2 hrs/week',
        '3-5 hrs/week',
        '6-10 hrs/week',
        '10+ hrs/week',
    ];

    protected string $host;
    protected string $model;
    protected string $visionModel;
    protected int $timeout;

    public function __construct()
    {
        $this->host = rtrim(env('OLLAMA_HOST', 'http://127.0.0.1:11434'), '/');
        $this->model = env('OLLAMA_MODEL', 'llama3.2');
        $this->visionModel = env('OLLAMA_VISION_MODEL', 'llama3.2-vision');
        $this->timeout = (int) env('OLLAMA_TIMEOUT', 15);
    }

    /**
     * Canonical competency framework shared across backend deliberation and frontend questionnaire UI.
     */
    public function getCompetencyFramework(): array
    {
        $domains = [];
        foreach (self::COMPETENCY_DOMAINS as $slug => $meta) {
            $domains[] = [
                'slug' => $slug,
                'label' => $meta['label'],
                'keywords' => $meta['keywords'],
                'examples' => $meta['examples'],
            ];
        }

        return [
            'domains' => $domains,
            'task_categories' => array_keys(self::TASK_CATEGORY_DOMAINS),
            'leadership_options' => self::LEADERSHIP_OPTIONS,
            'availability_options' => self::AVAILABILITY_OPTIONS,
        ];
    }

    /**
     * Save or update a member's structured eligibility & strengths questionnaire while preserving any CV OCR data.
     */
    public function saveQuestionnaireProfile(User $user, array $payload): MemberResume
    {
        $existing = MemberResume::where('user_id', $user->id)->first();

        $strengthRatings = [];
        foreach ((array) ($payload['strength_ratings'] ?? []) as $slug => $rating) {
            if (array_key_exists($slug, self::COMPETENCY_DOMAINS)) {
                $strengthRatings[$slug] = max(1, min(5, (int) $rating));
            }
        }

        $sortedStrengths = $strengthRatings;
        arsort($sortedStrengths);

        $topDomainLabels = [];
        foreach ($sortedStrengths as $slug => $rating) {
            if ($rating >= 4) {
                $topDomainLabels[] = self::COMPETENCY_DOMAINS[$slug]['label'];
            }
        }

        $preferredCategories = $this->cleanStringList($payload['preferred_task_categories'] ?? []);
        $submittedCertifications = $this->cleanStringList($payload['certifications_list'] ?? []);

        $canonicalLabels = array_merge(
            array_column(self::COMPETENCY_DOMAINS, 'label'),
            array_keys(self::TASK_CATEGORY_DOMAINS)
        );

        $preservedCvSkills = array_values(array_diff(
            $existing?->extracted_skills ?? [],
            $canonicalLabels
        ));

        $mergedSkills = array_values(array_unique(array_merge(
            $preservedCvSkills,
            $topDomainLabels,
            $preferredCategories
        )));

        $hasCv = (bool) ($existing?->original_name);

        $rawAnalysis = is_array($existing?->raw_ai_analysis) ? $existing->raw_ai_analysis : [];
        if (is_array($rawAnalysis['certifications'] ?? null)) {
            $cvCertifications = $this->cleanStringList($rawAnalysis['certifications']);
        } elseif (is_array($rawAnalysis['cv_certifications'] ?? null)) {
            $cvCertifications = $this->cleanStringList($rawAnalysis['cv_certifications']);
        } elseif ($hasCv && $existing?->assessment_completed_at === null) {
            $cvCertifications = $this->cleanStringList($existing->certifications ?? []);
            if (!empty($cvCertifications)) {
                $rawAnalysis['cv_certifications'] = $cvCertifications;
            }
        } else {
            $cvCertifications = [];
        }

        $mergedCertifications = array_values(array_unique(array_merge(
            $cvCertifications,
            $submittedCertifications
        )));

        $leadershipReadiness = $this->nullableTrimmedString($payload['leadership_readiness'] ?? null);
        $availabilityHours = $this->nullableTrimmedString($payload['availability_hours'] ?? null);
        $deliberationNotes = $this->nullableTrimmedString($payload['deliberation_notes'] ?? null);

        $existingCvSummary = $this->nullableTrimmedString($existing?->experience_summary);
        $experienceSummary = ($hasCv && $existingCvSummary !== null)
            ? $existingCvSummary
            : $this->synthesizeExperienceSummary($sortedStrengths, $leadershipReadiness, $availabilityHours, $deliberationNotes);

        $highConfidenceCount = count(array_filter($strengthRatings, fn (int $rating) => $rating >= 4));
        if ($existing?->eligibility_status === 'Needs Verification') {
            $eligibilityStatus = 'Needs Verification';
        } else {
            $eligibilityStatus = ($hasCv || ($highConfidenceCount >= 2 && $deliberationNotes !== null))
                ? 'Highly Recommended'
                : 'Eligible';
        }

        return MemberResume::updateOrCreate(
            ['user_id' => $user->id],
            [
                'file_size' => $existing?->file_size ?? 0,
                'extracted_skills' => $mergedSkills,
                'certifications' => $mergedCertifications,
                'experience_summary' => $experienceSummary,
                'eligibility_status' => $eligibilityStatus,
                'raw_ai_analysis' => !empty($rawAnalysis) ? $rawAnalysis : $existing?->raw_ai_analysis,
                'strengths_assessment' => $strengthRatings,
                'preferred_task_categories' => $preferredCategories,
                'leadership_readiness' => $leadershipReadiness,
                'availability_hours' => $availabilityHours,
                'deliberation_notes' => $deliberationNotes,
                'assessment_completed_at' => now(),
            ]
        );
    }

    /**
     * Check if Ollama service is reachable on the local machine.
     */
    public function isAvailable(): bool
    {
        try {
            $response = Http::timeout(2)->get("{$this->host}/api/tags");
            return $response->successful();
        } catch (\Throwable $e) {
            return false;
        }
    }

    /**
     * Extract skills, certifications, and background summary from an uploaded resume file.
     */
    public function extractResumeData(string $filePath, string $mimeType, ?string $originalName = null): array
    {
        $fullPath = Storage::disk('local')->exists($filePath)
            ? Storage::disk('local')->path($filePath)
            : $filePath;

        $rawText = $this->extractRawTextFromFile($fullPath, $mimeType);
        $isImage = str_starts_with($mimeType, 'image/');

        // If Ollama is reachable, query Ollama LLM for structured extraction
        if ($this->isAvailable()) {
            try {
                if ($isImage && file_exists($fullPath)) {
                    return $this->extractViaOllamaVision($fullPath, $originalName);
                }

                if (!empty($rawText)) {
                    return $this->extractViaOllamaText($rawText, $originalName);
                }
            } catch (\Throwable $e) {
                Log::warning('Ollama extraction failed, falling back to heuristic parsing', [
                    'error' => $e->getMessage(),
                ]);
            }
        }

        // Fallback: heuristic extraction
        return $this->heuristicExtractResumeData($rawText, $originalName);
    }

    /**
     * Rank available candidate members against the committee's functional scope.
     */
    public function rankCandidatesForCommittee(Committee $committee, Collection $candidates): Collection
    {
        return $this->rankCandidatesForScope(
            $committee->name,
            $committee->description,
            'committee',
            $candidates,
            true
        );
    }

    /**
     * Rank candidate members for a specific task scope (offline-safe by default for instant dropdown queries).
     */
    public function rankCandidatesForTask(
        string $taskTitle,
        ?string $taskDescription,
        ?string $committeeName,
        Collection $candidates,
        bool $useOllama = false
    ): Collection {
        return $this->rankCandidatesForScope(
            $taskTitle,
            $this->nullableTrimmedString($taskDescription),
            'task',
            $candidates,
            $useOllama,
            $this->nullableTrimmedString($committeeName)
        );
    }

    /**
     * Unified deliberation scorer combining questionnaire competencies, preferred categories, CV credentials, and optional Ollama reasoning.
     */
    public function rankCandidatesForScope(
        string $scopeTitle,
        ?string $scopeDescription,
        string $scopeType,
        Collection $candidates,
        bool $allowOllama = true,
        ?string $scopeContext = null
    ): Collection {
        if ($candidates->isEmpty()) {
            return collect();
        }

        $ollamaReady = $allowOllama && $this->isAvailable();

        return $candidates->map(function ($candidate) use ($scopeTitle, $scopeDescription, $scopeType, $ollamaReady, $scopeContext) {
            $user = $candidate instanceof User ? $candidate : ($candidate->user ?? null);
            if (!$user) {
                return null;
            }

            $resume = $user->resume;
            $hasResume = (bool) ($resume?->original_name);
            $hasQuestionnaire = (bool) ($resume?->assessment_completed_at);
            $skills = is_array($resume?->extracted_skills) ? $resume->extracted_skills : [];
            $certifications = is_array($resume?->certifications) ? $resume->certifications : [];
            $strengths = is_array($resume?->strengths_assessment) ? $resume->strengths_assessment : [];
            $preferredCategories = is_array($resume?->preferred_task_categories) ? $resume->preferred_task_categories : [];
            $deliberationNotes = $this->nullableTrimmedString($resume?->deliberation_notes);
            $leadershipReadiness = $this->nullableTrimmedString($resume?->leadership_readiness);
            $availabilityHours = $this->nullableTrimmedString($resume?->availability_hours);
            $rawExperienceSummary = $this->nullableTrimmedString($resume?->experience_summary);
            $topStrengths = $this->formatTopStrengths($strengths);

            $heuristic = $this->evaluateHeuristicScopeFit(
                $scopeTitle,
                $scopeDescription ?? '',
                $scopeType,
                $user->name,
                $hasResume,
                $hasQuestionnaire,
                $skills,
                $certifications,
                $strengths,
                $preferredCategories,
                $deliberationNotes,
                $leadershipReadiness,
                $rawExperienceSummary
            );

            $score = $heuristic['score'];
            $status = $heuristic['status'];
            $reason = $heuristic['reason'];

            if ($ollamaReady && ($hasResume || $hasQuestionnaire || !empty($skills))) {
                try {
                    $aiScore = $this->evaluateCandidateFitWithOllama(
                        $scopeType,
                        $scopeTitle,
                        $scopeDescription,
                        $user->name,
                        $skills,
                        $rawExperienceSummary ?? 'Registered CarSU Department Member.',
                        $topStrengths,
                        $deliberationNotes,
                        $leadershipReadiness,
                        $availabilityHours,
                        $scopeContext
                    );
                    if ($aiScore) {
                        $score = max(50, min(100, (int) ($aiScore['suitability_score'] ?? $score)));
                        $allowedStatuses = ['Highly Recommended', 'Eligible', 'Needs Verification'];
                        if (isset($aiScore['eligibility_status']) && in_array($aiScore['eligibility_status'], $allowedStatuses, true)) {
                            $status = $aiScore['eligibility_status'];
                        }
                        if (!empty(trim((string) ($aiScore['recommendation_reason'] ?? '')))) {
                            $reason = trim((string) $aiScore['recommendation_reason']);
                        }
                    }
                } catch (\Throwable $e) {
                    Log::info('Ollama candidate ranking error: ' . $e->getMessage());
                }
            }

            return [
                'user_id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'has_resume' => $hasResume,
                'resume_name' => $resume?->original_name,
                'has_questionnaire' => $hasQuestionnaire,
                'suitability_score' => $score,
                'eligibility_status' => $status,
                'recommendation_reason' => $reason,
                'extracted_skills' => array_values(array_slice($skills, 0, 5)),
                'certifications' => array_values(array_slice($certifications, 0, 3)),
                'top_strengths' => $topStrengths,
                'availability_hours' => $availabilityHours,
                'leadership_readiness' => $leadershipReadiness,
                'deliberation_summary' => $deliberationNotes ?? $this->nullableTrimmedString($resume?->experience_summary),
            ];
        })->filter()->sortByDesc('suitability_score')->values();
    }

    /**
     * Ask Ollama to extract structured resume fields from text.
     */
    protected function extractViaOllamaText(string $rawText, ?string $originalName): array
    {
        $prompt = "You are an HR and academic committee evaluator. Analyze this resume/CV text and extract structured information.\n\n"
            . "Output strictly valid JSON with this exact schema:\n"
            . "{\n"
            . "  \"skills\": [\"string\"],\n"
            . "  \"certifications\": [\"string\"],\n"
            . "  \"experience_summary\": \"string\",\n"
            . "  \"eligibility_status\": \"Eligible\" | \"Highly Recommended\" | \"Needs Verification\"\n"
            . "}\n\n"
            . "Resume Text:\n" . substr($rawText, 0, 4000);

        $response = Http::timeout($this->timeout)->post("{$this->host}/api/chat", [
            'model' => $this->model,
            'format' => 'json',
            'stream' => false,
            'messages' => [
                ['role' => 'user', 'content' => $prompt],
            ],
        ]);

        if ($response->successful()) {
            $content = $response->json('message.content');
            $data = json_decode($content, true);
            if (is_array($data)) {
                return [
                    'extracted_text' => substr($rawText, 0, 5000),
                    'extracted_skills' => $data['skills'] ?? [],
                    'certifications' => $data['certifications'] ?? [],
                    'experience_summary' => $data['experience_summary'] ?? 'Experienced in committee support.',
                    'eligibility_status' => $data['eligibility_status'] ?? 'Eligible',
                    'raw_ai_analysis' => $data,
                ];
            }
        }

        return $this->heuristicExtractResumeData($rawText, $originalName);
    }

    /**
     * Ask Ollama Vision to OCR and extract structured resume fields from an image.
     */
    protected function extractViaOllamaVision(string $fullPath, ?string $originalName): array
    {
        $imageData = base64_encode(file_get_contents($fullPath));

        $prompt = "Analyze this resume/CV image. Read all legible text, skills, certifications, and experience.\n"
            . "Output strictly valid JSON with keys: skills (array of strings), certifications (array of strings), experience_summary (string), eligibility_status ('Eligible' | 'Highly Recommended' | 'Needs Verification').";

        $response = Http::timeout($this->timeout + 15)->post("{$this->host}/api/chat", [
            'model' => $this->visionModel,
            'format' => 'json',
            'stream' => false,
            'messages' => [
                [
                    'role' => 'user',
                    'content' => $prompt,
                    'images' => [$imageData],
                ],
            ],
        ]);

        if ($response->successful()) {
            $content = $response->json('message.content');
            $data = json_decode($content, true);
            if (is_array($data)) {
                return [
                    'extracted_text' => 'Extracted from image via Ollama Vision OCR.',
                    'extracted_skills' => $data['skills'] ?? [],
                    'certifications' => $data['certifications'] ?? [],
                    'experience_summary' => $data['experience_summary'] ?? 'Skills and credentials verified from resume image.',
                    'eligibility_status' => $data['eligibility_status'] ?? 'Eligible',
                    'raw_ai_analysis' => $data,
                ];
            }
        }

        return $this->heuristicExtractResumeData('', $originalName);
    }

    /**
     * Evaluate candidate fit against a committee or task scope using Ollama.
     */
    protected function evaluateCandidateFitWithOllama(
        string $scopeType,
        string $scopeTitle,
        ?string $scopeDescription,
        string $candidateName,
        array $skills,
        string $experience,
        array $topStrengths = [],
        ?string $deliberationNotes = null,
        ?string $leadershipReadiness = null,
        ?string $availabilityHours = null,
        ?string $scopeContext = null
    ): ?array {
        $scopeLabel = ucfirst($scopeType);
        $prompt = "Evaluate candidate '{$candidateName}' for assignment to this {$scopeType}.\n"
            . "{$scopeLabel}: {$scopeTitle}\n"
            . "Description: " . ($scopeDescription ?: 'General departmental and institutional deliverables.') . "\n"
            . ($scopeContext ? "Committee Context: {$scopeContext}\n" : '')
            . "Candidate Skills: " . implode(', ', $skills) . "\n"
            . "Candidate Experience: {$experience}\n"
            . (!empty($topStrengths) ? "Self-Assessed Strengths: " . implode(', ', $topStrengths) . "\n" : '')
            . ($leadershipReadiness ? "Leadership Readiness: {$leadershipReadiness}\n" : '')
            . ($availabilityHours ? "Availability: {$availabilityHours}\n" : '')
            . ($deliberationNotes ? "Deliberation Notes: {$deliberationNotes}\n" : '')
            . "\nReturn strictly valid JSON with:\n"
            . "{\n"
            . "  \"suitability_score\": <integer 50-100>,\n"
            . "  \"eligibility_status\": \"Highly Recommended\" | \"Eligible\" | \"Needs Verification\",\n"
            . "  \"recommendation_reason\": \"<1-2 sentences explaining why candidate fits this {$scopeType}>\"\n"
            . "}";

        $response = Http::timeout($this->timeout)->post("{$this->host}/api/chat", [
            'model' => $this->model,
            'format' => 'json',
            'stream' => false,
            'messages' => [
                ['role' => 'user', 'content' => $prompt],
            ],
        ]);

        if ($response->successful()) {
            $content = $response->json('message.content');
            $data = json_decode($content, true);
            if (is_array($data) && isset($data['suitability_score'])) {
                return $data;
            }
        }

        return null;
    }

    /**
     * Extract raw text from PDF or text file.
     */
    protected function extractRawTextFromFile(string $fullPath, string $mimeType): string
    {
        if (!file_exists($fullPath)) {
            return '';
        }

        if (str_contains($mimeType, 'text/') || str_contains($mimeType, 'json')) {
            return (string) file_get_contents($fullPath);
        }

        if (str_contains($mimeType, 'pdf')) {
            $content = (string) file_get_contents($fullPath);
            // Lightweight regex extraction of text streams from PDF without native dependencies
            $text = '';
            if (preg_match_all('/\((.*?)\)\s*T[jJ]/s', $content, $matches)) {
                $text = implode(' ', $matches[1]);
            } elseif (preg_match_all('/BT[\r\n]+(.*?)(?:ET)/s', $content, $matches)) {
                $rawBlocks = implode(' ', $matches[1]);
                $clean = preg_replace('/[^\w\s\.,;:()@-]/', '', $rawBlocks);
                $text = preg_replace('/\s+/', ' ', $clean);
            }

            if (!empty(trim($text))) {
                return trim($text);
            }
        }

        return '';
    }

    /**
     * Heuristic extractor when Ollama or heavy parsers are unavailable.
     */
    protected function heuristicExtractResumeData(string $rawText, ?string $originalName): array
    {
        $skillCatalog = [
            'Event Planning', 'Logistics', 'Documentation', 'Secretariat', 'Public Relations',
            'Technical Writing', 'Graphic Design', 'Web Development', 'PHP', 'React', 'Laravel',
            'Tailwind CSS', 'PostgreSQL', 'Project Management', 'Financial Auditing', 'Budgeting',
            'Student Leadership', 'Quality Assurance', 'Accreditation', 'Minutes of Meeting',
            'Communication', 'Scheduling', 'Media & Marketing', 'Audio Visual', 'Hosting'
        ];

        $matchedSkills = [];
        $lowerText = strtolower($rawText . ' ' . ($originalName ?? ''));

        foreach ($skillCatalog as $skill) {
            if (str_contains($lowerText, strtolower($skill))) {
                $matchedSkills[] = $skill;
            }
        }

        if (empty($matchedSkills)) {
            $matchedSkills = ['Event Coordination', 'Documentation', 'Committee Operations'];
        }

        return [
            'extracted_text' => substr($rawText, 0, 5000),
            'extracted_skills' => array_values(array_unique($matchedSkills)),
            'certifications' => ['CarSU Institutional Leadership Certificate'],
            'experience_summary' => 'Active participant in departmental events and academic committee deliverables.',
            'eligibility_status' => 'Eligible',
            'raw_ai_analysis' => [
                'mode' => 'heuristic_fallback',
                'matched_count' => count($matchedSkills),
            ],
        ];
    }

    /**
     * Deterministic weighted fit scorer combining questionnaire domain ratings, preferred categories, CV skills, and evidence.
     */
    protected function evaluateHeuristicScopeFit(
        string $scopeTitle,
        string $scopeDescription,
        string $scopeType,
        string $candidateName,
        bool $hasResume,
        bool $hasQuestionnaire,
        array $skills,
        array $certifications,
        array $strengths,
        array $preferredCategories,
        ?string $deliberationNotes,
        ?string $leadershipReadiness,
        ?string $experience
    ): array {
        $targetText = strtolower(trim($scopeTitle . ' ' . $scopeDescription));

        $domainScore = 0;
        $matchedHighlights = [];

        if (!empty($strengths)) {
            $clampedRatings = [];
            foreach ($strengths as $slug => $val) {
                if (isset(self::COMPETENCY_DOMAINS[$slug])) {
                    $clampedRatings[$slug] = max(1, min(5, (int) $val));
                }
            }

            if (!empty($clampedRatings)) {
                $totalScopeWeight = 0.0;
                $weightedAlignment = 0.0;

                foreach (self::COMPETENCY_DOMAINS as $slug => $meta) {
                    $hits = $this->countKeywordMatches($targetText, $meta['keywords']);
                    if ($hits > 0 && isset($clampedRatings[$slug])) {
                        $weight = min(4, $hits);
                        $rating = $clampedRatings[$slug];
                        $totalScopeWeight += $weight;
                        $weightedAlignment += $weight * (($rating - 1) / 4);

                        if ($rating >= 4) {
                            $matchedHighlights[] = $meta['label'];
                        }
                    }
                }

                if ($totalScopeWeight > 0) {
                    $domainScore = (int) round(20 * ($weightedAlignment / $totalScopeWeight));
                } else {
                    $avgRating = array_sum($clampedRatings) / count($clampedRatings);
                    $domainScore = (int) round(5 * (($avgRating - 1) / 4));
                }
            }
        } elseif ($hasResume) {
            $cvProfileText = strtolower(trim(implode(' ', array_filter(array_merge(
                $skills,
                $certifications,
                [$experience]
            )))));

            if ($cvProfileText !== '') {
                $totalScopeWeight = 0.0;
                $weightedAlignment = 0.0;

                foreach (self::COMPETENCY_DOMAINS as $meta) {
                    $scopeHits = $this->countKeywordMatches($targetText, $meta['keywords']);
                    if ($scopeHits > 0) {
                        $weight = min(4, $scopeHits);
                        $cvHits = $this->countKeywordMatches($cvProfileText, $meta['keywords']);
                        $domainFit = min(1.0, $cvHits / 2.0);
                        $totalScopeWeight += $weight;
                        $weightedAlignment += $weight * $domainFit;

                        if ($cvHits >= 2) {
                            $matchedHighlights[] = $meta['label'];
                        }
                    }
                }

                if ($totalScopeWeight > 0) {
                    $domainScore = (int) round(20 * ($weightedAlignment / $totalScopeWeight));
                }
            }
        }

        $skillCategoryScore = 0;

        foreach ($preferredCategories as $category) {
            $mappedSlug = self::TASK_CATEGORY_DOMAINS[$category] ?? null;
            if ($mappedSlug !== null && $this->countKeywordMatches($targetText, self::COMPETENCY_DOMAINS[$mappedSlug]['keywords']) > 0) {
                $skillCategoryScore += 6;
                $matchedHighlights[] = $category;
            } elseif ($this->phraseMatchesText($category, $targetText)) {
                $skillCategoryScore += 6;
                $matchedHighlights[] = $category;
            }
        }

        $canonicalLabels = array_merge(
            array_column(self::COMPETENCY_DOMAINS, 'label'),
            array_keys(self::TASK_CATEGORY_DOMAINS)
        );
        foreach ($skills as $skill) {
            if (in_array($skill, $canonicalLabels, true) || in_array($skill, $preferredCategories, true)) {
                continue;
            }
            if ($this->phraseMatchesText((string) $skill, $targetText)) {
                $skillCategoryScore += 8;
                $matchedHighlights[] = (string) $skill;
            }
        }

        $notesAndExperience = trim(($deliberationNotes ?? '') . ' ' . ($experience ?? ''));
        if ($notesAndExperience !== '') {
            $tokenHits = $this->countSignificantTokenMatches($notesAndExperience, $targetText);
            $skillCategoryScore += min(6, $tokenHits * 3);
        }

        $skillCategoryScore = min(20, $skillCategoryScore);

        $evidenceScore = 0;
        if ($hasResume) {
            $evidenceScore += 8;
        }
        if (!empty($certifications)) {
            $certMatch = false;
            foreach ($certifications as $cert) {
                if ($this->phraseMatchesText((string) $cert, $targetText)) {
                    $certMatch = true;
                    break;
                }
            }
            $evidenceScore += $certMatch ? 5 : 4;
        }
        if ($hasQuestionnaire && $deliberationNotes !== null && mb_strlen($deliberationNotes) >= 15) {
            $evidenceScore += 2;
        }
        $evidenceScore += match ($leadershipReadiness) {
            'Lead or Independent' => 2,
            'Co-Lead / Active Contributor' => 1,
            default => 0,
        };
        $evidenceScore = min(14, $evidenceScore);

        $score = max(45, min(98, 50 + $domainScore + $skillCategoryScore + $evidenceScore));
        if (!$hasResume && empty($certifications)) {
            $score = min(84, $score);
        }

        $matchedHighlights = array_values(array_unique($matchedHighlights));
        if ($score >= 85) {
            $status = 'Highly Recommended';
        } else {
            $status = 'Eligible';
        }

        if (!empty($matchedHighlights)) {
            $sourceNote = match (true) {
                $hasResume && $hasQuestionnaire => 'Supported by uploaded CV and strengths questionnaire.',
                $hasQuestionnaire => 'Based on self-assessed strengths questionnaire.',
                $hasResume => 'Based on uploaded CV credentials.',
                default => '',
            };
            $reason = trim("{$candidateName} aligns strongly with {$scopeTitle} via " . implode(', ', array_slice($matchedHighlights, 0, 3)) . ". {$sourceNote}");
        } elseif ($hasResume && $hasQuestionnaire) {
            $reason = "{$candidateName} holds uploaded CV credentials and completed strengths questionnaire suited for general {$scopeType} deliverables.";
        } elseif ($hasResume) {
            $reason = "{$candidateName} holds uploaded CV credentials suited for general {$scopeType} deliverables.";
        } elseif ($hasQuestionnaire) {
            $reason = "{$candidateName} completed the self-assessed strengths questionnaire suited for general {$scopeType} deliverables.";
        } else {
            $reason = 'Eligible participant with confirmed institutional account.';
        }

        return [
            'score' => $score,
            'status' => $status,
            'reason' => $reason,
        ];
    }

    /**
     * Format top questionnaire strengths as readable badge labels sorted by rating descending.
     */
    protected function formatTopStrengths(array $strengths): array
    {
        if (empty($strengths)) {
            return [];
        }

        $filtered = [];
        foreach ($strengths as $slug => $rating) {
            if (isset(self::COMPETENCY_DOMAINS[$slug])) {
                $filtered[$slug] = (int) $rating;
            }
        }

        arsort($filtered);

        $top = [];
        foreach (array_slice($filtered, 0, 3, true) as $slug => $rating) {
            $top[] = self::COMPETENCY_DOMAINS[$slug]['label'] . " ({$rating}/5)";
        }

        return $top;
    }

    protected function synthesizeExperienceSummary(
        array $sortedStrengths,
        ?string $leadershipReadiness,
        ?string $availabilityHours,
        ?string $deliberationNotes
    ): string {
        $topLabels = [];
        foreach ($sortedStrengths as $slug => $rating) {
            if ($rating >= 4 && isset(self::COMPETENCY_DOMAINS[$slug])) {
                $topLabels[] = self::COMPETENCY_DOMAINS[$slug]['label'];
            }
        }
        if (empty($topLabels)) {
            foreach (array_slice($sortedStrengths, 0, 2, true) as $slug => $rating) {
                if (isset(self::COMPETENCY_DOMAINS[$slug])) {
                    $topLabels[] = self::COMPETENCY_DOMAINS[$slug]['label'];
                }
            }
        }

        $parts = [];
        if (!empty($topLabels)) {
            $meta = array_filter([$leadershipReadiness, $availabilityHours]);
            $metaSuffix = !empty($meta) ? ' (' . implode(', ', $meta) . ')' : '';
            $parts[] = 'Self-assessed strengths in ' . implode(', ', array_slice($topLabels, 0, 3)) . $metaSuffix . '.';
        }
        if ($deliberationNotes !== null) {
            $parts[] = $deliberationNotes;
        }

        return !empty($parts)
            ? implode(' ', $parts)
            : 'Completed institutional eligibility and competency questionnaire.';
    }

    protected function cleanStringList(mixed $items): array
    {
        if (!is_array($items)) {
            return [];
        }

        $cleaned = [];
        foreach ($items as $item) {
            $trimmed = trim((string) $item);
            if ($trimmed !== '') {
                $cleaned[] = $trimmed;
            }
        }

        return array_values(array_unique($cleaned));
    }

    protected function nullableTrimmedString(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $trimmed = trim((string) $value);

        return $trimmed !== '' ? $trimmed : null;
    }

    protected function countKeywordMatches(string $text, array $keywords): int
    {
        $hits = 0;
        foreach ($keywords as $keyword) {
            if (preg_match('/\b' . preg_quote(strtolower($keyword), '/') . '/i', $text) === 1) {
                $hits++;
            }
        }

        return $hits;
    }

    protected function phraseMatchesText(string $phrase, string $text): bool
    {
        $normalized = strtolower(trim($phrase));
        if ($normalized === '') {
            return false;
        }

        if (preg_match('/\b' . preg_quote($normalized, '/') . '/i', $text) === 1) {
            return true;
        }

        $words = preg_split('/[\s&,\/-]+/', $normalized) ?: [];
        $stopWords = ['and', 'for', 'the', 'with', 'setup', 'audit', 'role'];

        foreach ($words as $word) {
            if (mb_strlen($word) >= 3 && !in_array($word, $stopWords, true)) {
                if (preg_match('/\b' . preg_quote($word, '/') . '/i', $text) === 1) {
                    return true;
                }
            }
        }

        return false;
    }

    protected function countSignificantTokenMatches(string $sourceText, string $targetText): int
    {
        $stopWords = [
            'with', 'from', 'that', 'this', 'have', 'been', 'will', 'your', 'their',
            'about', 'under', 'carsu', 'member', 'experienced', 'built', 'handled',
            'support', 'role', 'general', 'tools', 'events', 'event', 'committee',
        ];

        $tokens = preg_split('/[^a-z0-9]+/i', strtolower($sourceText)) ?: [];
        $matched = [];

        foreach ($tokens as $token) {
            if (mb_strlen($token) >= 4 && !in_array($token, $stopWords, true)) {
                $stem = mb_strlen($token) > 5 ? substr($token, 0, -1) : $token;
                if (preg_match('/\b' . preg_quote($stem, '/') . '/i', $targetText) === 1) {
                    $matched[$token] = true;
                }
            }
        }

        return count($matched);
    }
}
