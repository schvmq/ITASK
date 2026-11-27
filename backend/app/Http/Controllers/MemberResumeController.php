<?php

namespace App\Http\Controllers;

use App\Models\MemberResume;
use App\Models\Project;
use App\Models\User;
use App\Services\AI\OllamaResumeScreeningService;
use App\Services\Authorization\AuthorizationService;
use App\Services\Authorization\RoleRegistry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class MemberResumeController extends Controller
{
    public function __construct(
        protected OllamaResumeScreeningService $screeningService
    ) {}

    /**
     * Render the member's structured eligibility & strengths profile workspace.
     */
    public function profile(Request $request): Response
    {
        $resume = MemberResume::where('user_id', $request->user()->id)->first();

        return Inertia::render('Profile/EligibilityProfile', [
            'profile' => $this->formatProfile($resume),
            'framework' => $this->screeningService->getCompetencyFramework(),
            'sampleDeliberationTasks' => $this->getSampleDeliberationTasks(),
            'ollamaActive' => $this->screeningService->isAvailable(),
        ]);
    }

    /**
     * Save or update the authenticated user's eligibility & strengths questionnaire.
     */
    public function storeQuestionnaire(Request $request): JsonResponse|RedirectResponse
    {
        $validDomains = array_keys(OllamaResumeScreeningService::COMPETENCY_DOMAINS);

        $validated = $request->validate([
            'strength_ratings' => [
                'required',
                'array',
                'min:1',
                function (string $attribute, mixed $value, \Closure $fail) use ($validDomains): void {
                    if (!is_array($value)) {
                        return;
                    }
                    foreach (array_keys($value) as $slug) {
                        if (!in_array($slug, $validDomains, true)) {
                            $fail("Invalid competency domain: {$slug}.");
                            return;
                        }
                    }
                },
            ],
            'strength_ratings.*' => ['required', 'integer', 'min:1', 'max:5'],
            'preferred_task_categories' => ['nullable', 'array'],
            'preferred_task_categories.*' => ['string', 'max:120'],
            'certifications_list' => ['nullable', 'array'],
            'certifications_list.*' => ['nullable', 'string', 'max:150'],
            'leadership_readiness' => ['required', 'string', Rule::in(OllamaResumeScreeningService::LEADERSHIP_OPTIONS)],
            'availability_hours' => ['required', 'string', Rule::in(OllamaResumeScreeningService::AVAILABILITY_OPTIONS)],
            'deliberation_notes' => ['nullable', 'string', 'max:1500'],
        ]);

        $resume = $this->screeningService->saveQuestionnaireProfile($request->user(), $validated);

        if ($request->wantsJson() && !$request->header('X-Inertia')) {
            return response()->json([
                'success' => true,
                'message' => 'Eligibility & strengths profile saved successfully.',
                'profile' => $this->formatProfile($resume),
            ]);
        }

        return redirect()->back(302, [], route('eligibility-profile.index'))
            ->with('status', 'Eligibility & strengths profile saved successfully.');
    }

    /**
     * Upload and screen a member's resume/CV while preserving any completed questionnaire answers.
     */
    public function upload(Request $request, User $user): JsonResponse
    {
        $currentUser = Auth::user();

        // Allow user to upload their own resume, or admin/project leader
        if ($currentUser->id !== $user->id && !$currentUser->isAdmin()) {
            abort(403, 'Unauthorized to upload resume for this user.');
        }

        $request->validate([
            'resume' => 'required|file|mimes:pdf,png,jpg,jpeg,docx,txt|max:10240', // 10MB
        ]);

        $file = $request->file('resume');
        $originalName = $file->getClientOriginalName();
        $mimeType = $file->getClientMimeType() ?: $file->getMimeType();
        $fileSize = $file->getSize();

        // Store file safely in storage/app/resumes
        $path = $file->store("resumes/{$user->id}", 'local');

        // Extract skills and qualifications via Ollama
        $analysis = $this->screeningService->extractResumeData($path, $mimeType, $originalName);

        $existing = MemberResume::where('user_id', $user->id)->first();
        $hasQuestionnaire = $existing?->assessment_completed_at !== null;

        $cvSkills = $this->screeningService->normalizeStringList($analysis['extracted_skills'] ?? []);
        $cvCertifications = $this->screeningService->normalizeStringList($analysis['certifications'] ?? []);
        $rawAi = is_array($analysis['raw_ai_analysis'] ?? null) ? $analysis['raw_ai_analysis'] : [];
        $rawAi['cv_certifications'] = $cvCertifications;

        $attributes = [
            'original_name' => $originalName,
            'file_path' => $path,
            'file_size' => $fileSize,
            'mime_type' => $mimeType,
            'extracted_text' => $analysis['extracted_text'] ?? '',
            'raw_ai_analysis' => $rawAi,
        ];

        if ($hasQuestionnaire) {
            $oldCvCerts = $this->extractCvCertifications($existing);
            $existingSelfCerts = array_values(array_diff(
                $this->screeningService->normalizeStringList($existing->certifications ?? []),
                $oldCvCerts
            ));

            $canonicalLabels = array_merge(
                array_column(OllamaResumeScreeningService::COMPETENCY_DOMAINS, 'label'),
                array_keys(OllamaResumeScreeningService::TASK_CATEGORY_DOMAINS)
            );
            $existingSkills = $this->screeningService->normalizeStringList($existing->extracted_skills ?? []);
            $questionnaireSkills = $existing->original_name
                ? array_values(array_intersect(
                    $existingSkills,
                    array_merge($canonicalLabels, $this->screeningService->normalizeStringList($existing->preferred_task_categories ?? []))
                ))
                : $existingSkills;

            $cvSummary = trim((string) ($analysis['experience_summary'] ?? ''));
            $cvStatus = $analysis['eligibility_status'] ?? 'Eligible';

            if ($cvStatus === 'Needs Verification') {
                $eligibilityStatus = 'Needs Verification';
            } elseif ($existing->eligibility_status === 'Highly Recommended' || $cvStatus === 'Highly Recommended') {
                $eligibilityStatus = 'Highly Recommended';
            } else {
                $eligibilityStatus = $cvStatus;
            }

            $attributes = array_merge($attributes, [
                'extracted_skills' => array_values(array_unique(array_merge($cvSkills, $questionnaireSkills))),
                'certifications' => array_values(array_unique(array_merge($cvCertifications, $existingSelfCerts))),
                'experience_summary' => $cvSummary !== '' ? $cvSummary : $existing->experience_summary,
                'eligibility_status' => $eligibilityStatus,
                'strengths_assessment' => $existing->strengths_assessment,
                'preferred_task_categories' => $existing->preferred_task_categories,
                'leadership_readiness' => $existing->leadership_readiness,
                'availability_hours' => $existing->availability_hours,
                'deliberation_notes' => $existing->deliberation_notes,
                'assessment_completed_at' => $existing->assessment_completed_at,
            ]);
        } else {
            $attributes = array_merge($attributes, [
                'extracted_skills' => $cvSkills,
                'certifications' => $cvCertifications,
                'experience_summary' => $analysis['experience_summary'] ?? '',
                'eligibility_status' => $analysis['eligibility_status'] ?? 'Eligible',
            ]);
        }

        $memberResume = MemberResume::updateOrCreate(
            ['user_id' => $user->id],
            $attributes
        );

        return response()->json([
            'success' => true,
            'message' => 'Resume uploaded and analyzed successfully.',
            'resume' => [
                'id' => $memberResume->id,
                'original_name' => $memberResume->original_name,
                'skills' => $memberResume->extracted_skills,
                'certifications' => $memberResume->certifications,
                'experience_summary' => $memberResume->experience_summary,
                'eligibility_status' => $memberResume->eligibility_status,
                'has_resume' => (bool) $memberResume->original_name,
                'has_questionnaire' => (bool) $memberResume->assessment_completed_at,
            ],
        ]);
    }

    /**
     * Get member resume and eligibility questionnaire summary.
     */
    public function show(Request $request, User $user, AuthorizationService $authService): JsonResponse
    {
        $currentUser = $request->user();

        if (! $currentUser) {
            abort(403, 'Unauthorized to view eligibility profile for this user.');
        }

        $isOwnerOrAdmin = (int) $currentUser->id === (int) $user->id
            || $authService->isAdmin($currentUser);

        if (! $isOwnerOrAdmin) {
            $canManageInSharedProject = Project::query()
                ->where('status', '!=', Project::STATUS_ARCHIVED)
                ->where(function ($projectQuery) use ($currentUser) {
                    $projectQuery->where('created_by', $currentUser->id)
                        ->orWhereHas('roleAssignments', function ($roleQuery) use ($currentUser) {
                            $roleQuery->where('user_id', $currentUser->id)
                                ->whereIn('role', [
                                    RoleRegistry::ROLE_PROJECT_LEADER,
                                    RoleRegistry::ROLE_PROJECT_COMMITTEE,
                                    RoleRegistry::ROLE_PROJECT_STAFF,
                                ]);
                        })
                        ->orWhereHas('coChairDesignations', function ($coChairQuery) use ($currentUser) {
                            $coChairQuery->where('user_id', $currentUser->id);
                        });
                })
                ->where(function ($targetQuery) use ($user) {
                    $targetQuery->where('created_by', $user->id)
                        ->orWhereHas('roleAssignments', function ($roleQuery) use ($user) {
                            $roleQuery->where('user_id', $user->id);
                        })
                        ->orWhereHas('coChairDesignations', function ($coChairQuery) use ($user) {
                            $coChairQuery->where('user_id', $user->id);
                        });
                })
                ->exists();

            if (! $canManageInSharedProject) {
                abort(403, 'Unauthorized to view eligibility profile for this user.');
            }
        }

        $resume = MemberResume::where('user_id', $user->id)->first();

        if (!$resume) {
            return response()->json([
                'has_resume' => false,
                'has_questionnaire' => false,
            ]);
        }

        return response()->json([
            'has_resume' => (bool) $resume->original_name,
            'has_questionnaire' => (bool) $resume->assessment_completed_at,
            'original_name' => $resume->original_name,
            'skills' => $resume->extracted_skills ?? [],
            'certifications' => $resume->certifications ?? [],
            'experience_summary' => $resume->experience_summary,
            'eligibility_status' => $resume->eligibility_status,
            'strengths_assessment' => $resume->strengths_assessment ?? [],
            'preferred_task_categories' => $resume->preferred_task_categories ?? [],
            'leadership_readiness' => $resume->leadership_readiness,
            'availability_hours' => $resume->availability_hours,
            'deliberation_notes' => $resume->deliberation_notes,
            'assessment_completed_at' => $resume->assessment_completed_at?->toIso8601String(),
            'uploaded_at' => $resume->updated_at?->toIso8601String(),
        ]);
    }

    protected function formatProfile(?MemberResume $resume): array
    {
        return [
            'has_resume' => (bool) ($resume?->original_name),
            'has_questionnaire' => (bool) ($resume?->assessment_completed_at),
            'original_name' => $resume?->original_name,
            'extracted_skills' => $resume?->extracted_skills ?? [],
            'certifications' => $resume?->certifications ?? [],
            'cv_certifications' => $this->extractCvCertifications($resume),
            'experience_summary' => $resume?->experience_summary,
            'eligibility_status' => $resume?->eligibility_status,
            'strengths_assessment' => $resume?->strengths_assessment ?? [],
            'preferred_task_categories' => $resume?->preferred_task_categories ?? [],
            'leadership_readiness' => $resume?->leadership_readiness,
            'availability_hours' => $resume?->availability_hours,
            'deliberation_notes' => $resume?->deliberation_notes,
            'assessment_completed_at' => $resume?->assessment_completed_at?->toIso8601String(),
        ];
    }

    protected function extractCvCertifications(?MemberResume $resume): array
    {
        if (!$resume) {
            return [];
        }

        $rawAnalysis = is_array($resume->raw_ai_analysis) ? $resume->raw_ai_analysis : [];

        if (is_array($rawAnalysis['cv_certifications'] ?? null)) {
            return $this->screeningService->normalizeStringList($rawAnalysis['cv_certifications']);
        }

        if (is_array($rawAnalysis['certifications'] ?? null)) {
            return $this->screeningService->normalizeStringList($rawAnalysis['certifications']);
        }

        if ($resume->original_name && $resume->assessment_completed_at === null) {
            return $this->screeningService->normalizeStringList($resume->certifications ?? []);
        }

        return [];
    }

    protected function getSampleDeliberationTasks(): array
    {
        return [
            [
                'title' => 'Draft Criteria Alignment Report',
                'committee' => 'Documentation & Secretariat Committee',
                'description' => 'Compile PACUCOA narrative reports, minutes of meeting, and verify MOV alignment checklists.',
                'domains' => ['documentation_secretariat', 'quality_assurance'],
            ],
            [
                'title' => 'Develop Automated Attendance Tool',
                'committee' => 'Technical & Systems Committee',
                'description' => 'Build web portal dashboard, API endpoints, and database integration for event registration.',
                'domains' => ['technical_engineering', 'quality_assurance'],
            ],
            [
                'title' => 'Direct Committee Logistics',
                'committee' => 'Logistics & Operations Committee',
                'description' => 'Coordinate venue setup, equipment inventory, scheduling, and stakeholder facilitation.',
                'domains' => ['logistics_operations', 'leadership_facilitation'],
            ],
            [
                'title' => 'Produce Audio-Visual Brief',
                'committee' => 'Media & Communications Committee',
                'description' => 'Design event graphics, edit promotional video presentation, and draft publicity announcements.',
                'domains' => ['media_creative', 'documentation_secretariat'],
            ],
        ];
    }
}

