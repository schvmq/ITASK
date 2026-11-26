<?php

namespace Tests\Feature;

use App\Models\CoChairDesignation;
use App\Models\Committee;
use App\Models\MemberResume;
use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Models\User;
use App\Services\AI\OllamaResumeScreeningService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class EligibilityQuestionnaireTest extends TestCase
{
    use RefreshDatabase;

    protected User $leader;
    protected User $techMember;
    protected User $docsMember;
    protected Project $project;
    protected Committee $committee;

    protected function setUp(): void
    {
        parent::setUp();

        $this->leader = User::factory()->create(['email_verified_at' => now()]);
        $this->techMember = User::factory()->create(['name' => 'Tech Specialist', 'email_verified_at' => now()]);
        $this->docsMember = User::factory()->create(['name' => 'Docs Coordinator', 'email_verified_at' => now()]);

        $this->project = Project::create([
            'created_by' => $this->leader->id,
            'title' => 'COE Accreditation Event',
            'status' => Project::STATUS_ACTIVE,
        ]);

        ProjectRoleAssignment::create([
            'project_id' => $this->project->id,
            'user_id' => $this->leader->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_LEADER,
        ]);

        $this->committee = Committee::create([
            'project_id' => $this->project->id,
            'name' => 'Technical & Video Systems Committee',
            'description' => 'Handles web portal setup, React dashboards, and technical video editing.',
        ]);

        foreach ([$this->techMember, $this->docsMember] as $u) {
            ProjectRoleAssignment::create([
                'project_id' => $this->project->id,
                'committee_id' => $this->committee->id,
                'user_id' => $u->id,
                'role' => ProjectRoleAssignment::ROLE_PROJECT_MEMBER,
            ]);
        }
    }

    public function test_user_can_save_questionnaire_without_uploading_cv_and_deliberate_task_fit(): void
    {
        $service = new OllamaResumeScreeningService();

        $resume = $service->saveQuestionnaireProfile($this->techMember, [
            'strength_ratings' => [
                'technical_engineering' => 5,
                'documentation_secretariat' => 2,
                'quality_assurance' => 4,
                'logistics_operations' => 3,
                'leadership_facilitation' => 4,
                'media_creative' => 3,
            ],
            'preferred_task_categories' => ['Web & System Setup', 'Quality & Evidence Audit'],
            'certifications_list' => ['Laravel & React Specialist'],
            'leadership_readiness' => 'Lead or Independent',
            'availability_hours' => '6-10 hrs/week',
            'deliberation_notes' => 'Built React dashboards and database tools for CCIS events.',
        ]);

        $this->assertNotNull($resume->assessment_completed_at);
        $this->assertNull($resume->original_name);
        $this->assertNull($resume->file_path);
        $this->assertNull($resume->mime_type);
        $this->assertContains('Technical & Web Engineering', $resume->extracted_skills);
        $this->assertEquals('Highly Recommended', $resume->eligibility_status);

        $service->saveQuestionnaireProfile($this->docsMember, [
            'strength_ratings' => [
                'technical_engineering' => 1,
                'documentation_secretariat' => 5,
                'quality_assurance' => 3,
                'logistics_operations' => 4,
                'leadership_facilitation' => 3,
                'media_creative' => 2,
            ],
            'preferred_task_categories' => ['Documentation & Minutes', 'Event Logistics'],
            'certifications_list' => ['Committee Secretariat Workshop'],
            'leadership_readiness' => 'Support Role',
            'availability_hours' => '3-5 hrs/week',
            'deliberation_notes' => 'Experienced in taking minutes and formatting MOV binders.',
        ]);

        $ranked = $service->rankCandidatesForTask(
            'Build React Data Table and API Integration',
            'Develop dashboard component and test endpoint permissions',
            $this->committee->name,
            collect([$this->docsMember->fresh('resume'), $this->techMember->fresh('resume')])
        );

        $this->assertCount(2, $ranked);
        $this->assertEquals($this->techMember->id, $ranked->first()['user_id']);
        $this->assertGreaterThan($ranked->last()['suitability_score'], $ranked->first()['suitability_score']);
        $this->assertFalse($ranked->first()['has_resume']);
        $this->assertTrue($ranked->first()['has_questionnaire']);
        $this->assertNotEmpty($ranked->first()['top_strengths']);
        $this->assertEquals('6-10 hrs/week', $ranked->first()['availability_hours']);
        $this->assertEquals('Lead or Independent', $ranked->first()['leadership_readiness']);
        $this->assertNotEmpty($ranked->first()['deliberation_summary']);
    }

    public function test_competency_framework_exposes_canonical_domains_and_options(): void
    {
        $service = new OllamaResumeScreeningService();
        $framework = $service->getCompetencyFramework();

        $this->assertArrayHasKey('domains', $framework);
        $this->assertArrayHasKey('task_categories', $framework);
        $this->assertArrayHasKey('leadership_options', $framework);
        $this->assertArrayHasKey('availability_options', $framework);

        $slugs = array_column($framework['domains'], 'slug');
        $labels = array_column($framework['domains'], 'label');

        $this->assertEquals([
            'technical_engineering',
            'documentation_secretariat',
            'quality_assurance',
            'logistics_operations',
            'leadership_facilitation',
            'media_creative',
        ], $slugs);

        $this->assertContains('Technical & Web Engineering', $labels);
        $this->assertContains('Documentation & Secretariat', $labels);
        $this->assertContains('Web & System Setup', $framework['task_categories']);
        $this->assertContains('Lead or Independent', $framework['leadership_options']);
        $this->assertContains('6-10 hrs/week', $framework['availability_options']);
    }

    public function test_saving_questionnaire_preserves_existing_cv_and_merges_credentials(): void
    {
        MemberResume::create([
            'user_id' => $this->techMember->id,
            'original_name' => 'tech_cv.pdf',
            'file_path' => 'resumes/tech_cv.pdf',
            'file_size' => 2048,
            'mime_type' => 'application/pdf',
            'extracted_text' => 'Full-stack Laravel and React engineer.',
            'extracted_skills' => ['Laravel', 'PostgreSQL'],
            'certifications' => ['AWS Cloud Practitioner'],
            'experience_summary' => '3 years building university web systems.',
            'eligibility_status' => 'Eligible',
        ]);

        $service = new OllamaResumeScreeningService();
        $updated = $service->saveQuestionnaireProfile($this->techMember, [
            'strength_ratings' => [
                'technical_engineering' => 5,
                'documentation_secretariat' => 2,
                'quality_assurance' => 3,
                'logistics_operations' => 2,
                'leadership_facilitation' => 3,
                'media_creative' => 2,
            ],
            'preferred_task_categories' => ['Web & System Setup'],
            'certifications_list' => ['AWS Cloud Practitioner', 'React Developer Certificate'],
            'leadership_readiness' => 'Co-Lead / Active Contributor',
            'availability_hours' => '10+ hrs/week',
            'deliberation_notes' => 'Maintained CCIS web portals.',
        ]);

        $this->assertEquals('tech_cv.pdf', $updated->original_name);
        $this->assertEquals('resumes/tech_cv.pdf', $updated->file_path);
        $this->assertEquals('application/pdf', $updated->mime_type);
        $this->assertEquals(2048, $updated->file_size);
        $this->assertEquals('3 years building university web systems.', $updated->experience_summary);
        $this->assertContains('Laravel', $updated->extracted_skills);
        $this->assertContains('Technical & Web Engineering', $updated->extracted_skills);
        $this->assertEquals(['AWS Cloud Practitioner', 'React Developer Certificate'], $updated->certifications);
        $this->assertEquals('Highly Recommended', $updated->eligibility_status);
    }

    public function test_rank_candidates_for_committee_unifies_cv_questionnaire_and_bare_accounts(): void
    {
        $bareMember = User::factory()->create(['name' => 'Bare Member', 'email_verified_at' => now()]);
        $cvOnlyMember = User::factory()->create(['name' => 'CV Only Member', 'email_verified_at' => now()]);

        MemberResume::create([
            'user_id' => $cvOnlyMember->id,
            'original_name' => 'video_tech_cv.pdf',
            'file_path' => 'resumes/video_tech_cv.pdf',
            'file_size' => 1500,
            'mime_type' => 'application/pdf',
            'extracted_skills' => ['Web Development', 'Audio Visual'],
            'certifications' => ['Broadcast Tech'],
            'experience_summary' => 'Handled video editing and web portal setup.',
            'eligibility_status' => 'Highly Recommended',
        ]);

        $service = new OllamaResumeScreeningService();
        $service->saveQuestionnaireProfile($this->techMember, [
            'strength_ratings' => [
                'technical_engineering' => 5,
                'media_creative' => 4,
            ],
            'preferred_task_categories' => ['Web & System Setup', 'Media & Visual Production'],
            'certifications_list' => [],
            'leadership_readiness' => 'Lead or Independent',
            'availability_hours' => '6-10 hrs/week',
            'deliberation_notes' => 'Web portal setup and video editing specialist.',
        ]);

        $ranked = $service->rankCandidatesForCommittee(
            $this->committee,
            collect([
                $bareMember->fresh('resume'),
                $cvOnlyMember->fresh('resume'),
                $this->techMember->fresh('resume'),
            ])
        );

        $this->assertCount(3, $ranked);

        $byUser = $ranked->keyBy('user_id');

        $this->assertFalse($byUser[$this->techMember->id]['has_resume']);
        $this->assertTrue($byUser[$this->techMember->id]['has_questionnaire']);

        $this->assertTrue($byUser[$cvOnlyMember->id]['has_resume']);
        $this->assertFalse($byUser[$cvOnlyMember->id]['has_questionnaire']);

        $this->assertFalse($byUser[$bareMember->id]['has_resume']);
        $this->assertFalse($byUser[$bareMember->id]['has_questionnaire']);
        $this->assertNull($byUser[$bareMember->id]['deliberation_summary']);

        $this->assertGreaterThan(
            $byUser[$bareMember->id]['suitability_score'],
            $byUser[$cvOnlyMember->id]['suitability_score']
        );
        $this->assertGreaterThan(
            $byUser[$bareMember->id]['suitability_score'],
            $byUser[$this->techMember->id]['suitability_score']
        );
    }

    public function test_rank_candidates_for_task_handles_empty_collection_and_unreachable_ollama_gracefully(): void
    {
        $previousHost = getenv('OLLAMA_HOST');
        putenv('OLLAMA_HOST=http://127.0.0.1:59999');

        try {
            $service = new OllamaResumeScreeningService();

            $this->assertTrue($service->rankCandidatesForTask('Empty Scope', null, null, collect())->isEmpty());

            $service->saveQuestionnaireProfile($this->techMember, [
                'strength_ratings' => ['technical_engineering' => 5],
                'preferred_task_categories' => ['Web & System Setup'],
                'leadership_readiness' => 'Lead or Independent',
                'availability_hours' => '6-10 hrs/week',
                'deliberation_notes' => 'Built Laravel APIs.',
            ]);

            $ranked = $service->rankCandidatesForTask(
                'Build Laravel API',
                'Implement API routes',
                null,
                collect([$this->techMember->fresh('resume')]),
                true
            );

            $this->assertCount(1, $ranked);
            $this->assertEquals($this->techMember->id, $ranked->first()['user_id']);
            $this->assertGreaterThanOrEqual(75, $ranked->first()['suitability_score']);
        } finally {
            if ($previousHost === false) {
                putenv('OLLAMA_HOST');
            } else {
                putenv("OLLAMA_HOST={$previousHost}");
            }
        }
    }

    public function test_cv_only_matching_candidate_achieves_highly_recommended_score(): void
    {
        $docsCommittee = Committee::create([
            'project_id' => $this->project->id,
            'name' => 'Documentation & Secretariat Committee',
            'description' => 'Responsible for PACUCOA accreditation documentation, minutes of meeting, and MOV archiving.',
        ]);

        $cvCandidate = User::factory()->create(['name' => 'CV Docs Specialist', 'email_verified_at' => now()]);
        MemberResume::create([
            'user_id' => $cvCandidate->id,
            'original_name' => 'candidate_cv.pdf',
            'file_path' => 'resumes/candidate_cv.pdf',
            'file_size' => 1024,
            'mime_type' => 'application/pdf',
            'extracted_skills' => ['Documentation', 'Secretariat', 'Technical Writing'],
            'certifications' => ['Accreditation Officer Training'],
            'experience_summary' => '3 years committee documentation lead at CarSU.',
            'eligibility_status' => 'Highly Recommended',
        ]);

        $service = new OllamaResumeScreeningService();
        $ranked = $service->rankCandidatesForScope(
            $docsCommittee->name,
            $docsCommittee->description,
            'committee',
            collect([$cvCandidate->fresh('resume')]),
            false
        );

        $this->assertCount(1, $ranked);
        $this->assertGreaterThanOrEqual(85, $ranked->first()['suitability_score']);
        $this->assertEquals('Highly Recommended', $ranked->first()['eligibility_status']);
        $this->assertTrue($ranked->first()['has_resume']);
        $this->assertFalse($ranked->first()['has_questionnaire']);
    }

    public function test_questionnaire_only_neutral_reason_does_not_claim_verified_credentials(): void
    {
        $service = new OllamaResumeScreeningService();
        $service->saveQuestionnaireProfile($this->techMember, [
            'strength_ratings' => ['technical_engineering' => 3],
            'preferred_task_categories' => [],
            'certifications_list' => [],
            'leadership_readiness' => 'Support Role',
            'availability_hours' => '1-2 hrs/week',
            'deliberation_notes' => 'Available to assist.',
        ]);

        $ranked = $service->rankCandidatesForTask(
            'General Hallway Assistance',
            'Assist visitors at main lobby',
            null,
            collect([$this->techMember->fresh('resume')]),
            false
        );

        $reason = $ranked->first()['recommendation_reason'];
        $this->assertStringNotContainsString('verified profile credentials', strtolower($reason));
        $this->assertStringContainsString('self-assessed strengths questionnaire', strtolower($reason));
    }

    public function test_saving_questionnaire_preserves_needs_verification_status_and_allows_editing_self_certs(): void
    {
        MemberResume::create([
            'user_id' => $this->docsMember->id,
            'original_name' => 'unverified_scan.png',
            'file_path' => 'resumes/unverified_scan.png',
            'file_size' => 512,
            'mime_type' => 'image/png',
            'extracted_skills' => ['Documentation'],
            'certifications' => ['CV Extracted Cert'],
            'experience_summary' => 'Pending registrar verification.',
            'eligibility_status' => 'Needs Verification',
            'raw_ai_analysis' => [
                'certifications' => ['CV Extracted Cert'],
            ],
        ]);

        $service = new OllamaResumeScreeningService();
        $updated = $service->saveQuestionnaireProfile($this->docsMember, [
            'strength_ratings' => [
                'documentation_secretariat' => 5,
                'quality_assurance' => 5,
            ],
            'preferred_task_categories' => ['Documentation & Minutes'],
            'certifications_list' => ['Typo Self Cert'],
            'leadership_readiness' => 'Lead or Independent',
            'availability_hours' => '6-10 hrs/week',
            'deliberation_notes' => 'Extensive documentation background.',
        ]);

        $this->assertEquals('Needs Verification', $updated->eligibility_status);
        $this->assertEquals(['CV Extracted Cert', 'Typo Self Cert'], $updated->certifications);

        // Removing typo self-entered cert preserves CV-extracted cert while dropping the removed self-entry
        $reUpdated = $service->saveQuestionnaireProfile($this->docsMember, [
            'strength_ratings' => ['documentation_secretariat' => 5],
            'preferred_task_categories' => ['Documentation & Minutes'],
            'certifications_list' => ['Clean Self Cert'],
            'leadership_readiness' => 'Lead or Independent',
            'availability_hours' => '6-10 hrs/week',
            'deliberation_notes' => 'Extensive documentation background.',
        ]);

        $this->assertEquals(['CV Extracted Cert', 'Clean Self Cert'], $reUpdated->certifications);

        // Pure questionnaire profile (no CV) cleanly replaces self-entered certifications
        $service->saveQuestionnaireProfile($this->techMember, [
            'strength_ratings' => ['technical_engineering' => 5],
            'certifications_list' => ['Typo Cert'],
            'leadership_readiness' => 'Support Role',
            'availability_hours' => '3-5 hrs/week',
        ]);
        $techEdited = $service->saveQuestionnaireProfile($this->techMember, [
            'strength_ratings' => ['technical_engineering' => 5],
            'certifications_list' => ['Valid Cert'],
            'leadership_readiness' => 'Support Role',
            'availability_hours' => '3-5 hrs/week',
        ]);

        $this->assertEquals(['Valid Cert'], $techEdited->certifications);
    }

    public function test_committee_and_department_noise_words_do_not_inflate_bare_accounts_or_misroute_tasks(): void
    {
        $bareMember = User::factory()->create(['name' => 'Bare Account', 'email_verified_at' => now()]);
        $coordinatorMember = User::factory()->create(['name' => 'Coordinator Only', 'email_verified_at' => now()]);

        $service = new OllamaResumeScreeningService();
        $service->saveQuestionnaireProfile($coordinatorMember, [
            'strength_ratings' => [
                'technical_engineering' => 1,
                'leadership_facilitation' => 5,
            ],
            'preferred_task_categories' => ['Committee Coordination'],
            'certifications_list' => [],
            'leadership_readiness' => 'Lead or Independent',
            'availability_hours' => '6-10 hrs/week',
            'deliberation_notes' => 'Led general assemblies.',
        ]);

        $service->saveQuestionnaireProfile($this->techMember, [
            'strength_ratings' => [
                'technical_engineering' => 5,
                'leadership_facilitation' => 2,
            ],
            'preferred_task_categories' => ['Web & System Setup'],
            'certifications_list' => [],
            'leadership_readiness' => 'Support Role',
            'availability_hours' => '6-10 hrs/week',
            'deliberation_notes' => 'Built React portal.',
        ]);

        // Even if committee name repeats "Committee Coordination Committee", a technical task must favor techMember,
        // and bareMember must not receive token-match inflation from placeholder "Registered CarSU Department Member."
        $ranked = $service->rankCandidatesForTask(
            'Build React API Portal',
            'Configure backend database endpoints',
            'Committee Coordination Committee',
            collect([$bareMember->fresh('resume'), $coordinatorMember->fresh('resume'), $this->techMember->fresh('resume')])
        );

        $byUser = $ranked->keyBy('user_id');
        $this->assertEquals($this->techMember->id, $ranked->first()['user_id']);
        $this->assertEquals(50, $byUser[$bareMember->id]['suitability_score']);

        $bareDepartmentScope = $service->rankCandidatesForScope(
            'Department Committee Review',
            'Department general assembly',
            'committee',
            collect([$bareMember->fresh('resume')]),
            false
        );
        $this->assertEquals(50, $bareDepartmentScope->first()['suitability_score']);
    }

    public function test_ollama_online_scoring_clamps_scores_and_falls_back_on_malformed_json(): void
    {
        $previousHost = getenv('OLLAMA_HOST');
        putenv('OLLAMA_HOST=http://127.0.0.1:11434');

        try {
            $service = new OllamaResumeScreeningService();
            $service->saveQuestionnaireProfile($this->techMember, [
                'strength_ratings' => ['technical_engineering' => 5],
                'preferred_task_categories' => ['Web & System Setup'],
                'certifications_list' => ['Laravel Certified'],
                'leadership_readiness' => 'Lead or Independent',
                'availability_hours' => '6-10 hrs/week',
                'deliberation_notes' => 'Built React dashboards.',
            ]);

            Http::fake([
                '127.0.0.1:11434/api/tags' => Http::response(['models' => []], 200),
                '127.0.0.1:11434/api/chat' => Http::sequence()
                    ->push([
                        'message' => [
                            'content' => json_encode([
                                'suitability_score' => 150,
                                'eligibility_status' => 'Highly Recommended',
                                'recommendation_reason' => 'Strong match verified by Ollama.',
                            ]),
                        ],
                    ], 200)
                    ->push([
                        'message' => [
                            'content' => json_encode([
                                'suitability_score' => 10,
                                'eligibility_status' => 'Needs Verification',
                                'recommendation_reason' => 'Lower bound clamped check.',
                            ]),
                        ],
                    ], 200)
                    ->push([
                        'message' => [
                            'content' => '{invalid json',
                        ],
                    ], 200),
            ]);

            $clampedHigh = $service->rankCandidatesForTask(
                'Build React Portal',
                'Create dashboard UI',
                null,
                collect([$this->techMember->fresh('resume')]),
                true
            );

            $this->assertEquals(100, $clampedHigh->first()['suitability_score']);
            $this->assertEquals('Strong match verified by Ollama.', $clampedHigh->first()['recommendation_reason']);

            $clampedLow = $service->rankCandidatesForTask(
                'Build React Portal',
                'Create dashboard UI',
                null,
                collect([$this->techMember->fresh('resume')]),
                true
            );

            $this->assertEquals(50, $clampedLow->first()['suitability_score']);
            $this->assertEquals('Needs Verification', $clampedLow->first()['eligibility_status']);

            $fallback = $service->rankCandidatesForTask(
                'Build React Portal',
                'Create dashboard UI',
                null,
                collect([$this->techMember->fresh('resume')]),
                true
            );

            $this->assertGreaterThanOrEqual(85, $fallback->first()['suitability_score']);
            $this->assertStringContainsString('aligns strongly', $fallback->first()['recommendation_reason']);
        } finally {
            if ($previousHost === false) {
                putenv('OLLAMA_HOST');
            } else {
                putenv("OLLAMA_HOST={$previousHost}");
            }
        }
    }

    public function test_verified_user_can_view_and_submit_eligibility_profile_via_http(): void
    {
        Http::fake(['127.0.0.1:11434/*' => Http::response([], 503)]);

        $this->get('/eligibility-profile')->assertRedirect('/login');

        $unverified = User::factory()->create(['email_verified_at' => null]);
        $this->actingAs($unverified)
            ->get('/eligibility-profile')
            ->assertRedirect(route('verification.notice'));

        $this->actingAs($this->techMember)
            ->get(route('eligibility-profile.index'))
            ->assertStatus(200)
            ->assertInertia(fn (Assert $page) => $page
                ->component('Profile/EligibilityProfile')
                ->has('profile')
                ->where('profile.has_resume', false)
                ->where('profile.has_questionnaire', false)
                ->has('framework.domains', 6)
                ->has('sampleDeliberationTasks', 4)
                ->where('ollamaActive', false)
            );

        $payload = [
            'strength_ratings' => [
                'technical_engineering' => 5,
                'documentation_secretariat' => 3,
                'quality_assurance' => 4,
                'logistics_operations' => 2,
                'leadership_facilitation' => 4,
                'media_creative' => 3,
            ],
            'preferred_task_categories' => ['Web & System Setup', 'Quality & Evidence Audit'],
            'certifications_list' => ['Laravel & React Specialist'],
            'leadership_readiness' => 'Lead or Independent',
            'availability_hours' => '6-10 hrs/week',
            'deliberation_notes' => 'Built React dashboards and API integrations for CCIS.',
        ];

        $this->actingAs($this->techMember)
            ->from(route('eligibility-profile.index'))
            ->post(route('eligibility-profile.store'), $payload)
            ->assertRedirect(route('eligibility-profile.index'))
            ->assertSessionHas('status');

        $resume = MemberResume::where('user_id', $this->techMember->id)->firstOrFail();
        $this->assertNotNull($resume->assessment_completed_at);
        $this->assertNull($resume->original_name);
        $this->assertEquals(5, $resume->strengths_assessment['technical_engineering']);
        $this->assertEquals(['Web & System Setup', 'Quality & Evidence Audit'], $resume->preferred_task_categories);
        $this->assertEquals('Lead or Independent', $resume->leadership_readiness);
        $this->assertEquals('6-10 hrs/week', $resume->availability_hours);
        $this->assertEquals('Built React dashboards and API integrations for CCIS.', $resume->deliberation_notes);

        $this->actingAs($this->techMember)
            ->get(route('eligibility-profile.index'))
            ->assertStatus(200)
            ->assertInertia(fn (Assert $page) => $page
                ->component('Profile/EligibilityProfile')
                ->where('profile.has_resume', false)
                ->where('profile.has_questionnaire', true)
                ->where('profile.strengths_assessment.technical_engineering', 5)
                ->where('profile.leadership_readiness', 'Lead or Independent')
                ->where('profile.availability_hours', '6-10 hrs/week')
                ->where('profile.deliberation_notes', 'Built React dashboards and API integrations for CCIS.')
            );

        $this->actingAs($this->techMember)
            ->getJson(route('users.resume.show', ['user' => $this->techMember->id]))
            ->assertStatus(200)
            ->assertJson([
                'has_resume' => false,
                'has_questionnaire' => true,
                'leadership_readiness' => 'Lead or Independent',
                'availability_hours' => '6-10 hrs/week',
                'deliberation_notes' => 'Built React dashboards and API integrations for CCIS.',
            ]);

        $this->actingAs($this->techMember)
            ->postJson(route('eligibility-profile.store'), [
                ...$payload,
                'availability_hours' => '10+ hrs/week',
                'deliberation_notes' => 'Updated availability for accreditation week.',
            ])
            ->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);

        $this->assertEquals('10+ hrs/week', $resume->fresh()->availability_hours);
        $this->assertEquals('Updated availability for accreditation week.', $resume->fresh()->deliberation_notes);
    }

    public function test_eligibility_profile_submission_validates_payload(): void
    {
        $this->actingAs($this->techMember)
            ->postJson(route('eligibility-profile.store'), [
                'strength_ratings' => ['technical_engineering' => 6],
                'preferred_task_categories' => ['Web & System Setup'],
                'leadership_readiness' => 'Invalid Readiness',
                'availability_hours' => '999 hrs/week',
                'deliberation_notes' => str_repeat('a', 1501),
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors([
                'strength_ratings.technical_engineering',
                'leadership_readiness',
                'availability_hours',
                'deliberation_notes',
            ]);

        $this->actingAs($this->techMember)
            ->postJson(route('eligibility-profile.store'), [
                'strength_ratings' => ['nonexistent_domain' => 4],
                'preferred_task_categories' => [],
                'leadership_readiness' => 'Support Role',
                'availability_hours' => '3-5 hrs/week',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['strength_ratings']);
    }

    public function test_resume_upload_preserves_existing_questionnaire_and_tracks_cv_certifications(): void
    {
        Storage::fake('local');
        Http::fake(['127.0.0.1:11434/*' => Http::response([], 503)]);

        $this->actingAs($this->techMember)
            ->postJson(route('eligibility-profile.store'), [
                'strength_ratings' => [
                    'technical_engineering' => 5,
                    'quality_assurance' => 4,
                ],
                'preferred_task_categories' => ['Web & System Setup'],
                'certifications_list' => ['Self Entered Cert'],
                'leadership_readiness' => 'Lead or Independent',
                'availability_hours' => '6-10 hrs/week',
                'deliberation_notes' => 'Built React dashboards for accreditation.',
            ])
            ->assertStatus(200);

        $cvFile = UploadedFile::fake()->createWithContent(
            'laravel_react_cv.txt',
            'Senior developer experienced in Laravel, React, PostgreSQL, and Project Management.'
        );

        $this->actingAs($this->techMember)
            ->postJson(route('users.resume.upload', ['user' => $this->techMember->id]), [
                'resume' => $cvFile,
            ])
            ->assertStatus(200)
            ->assertJson([
                'success' => true,
                'resume' => [
                    'original_name' => 'laravel_react_cv.txt',
                    'has_resume' => true,
                    'has_questionnaire' => true,
                ],
            ]);

        $resume = MemberResume::where('user_id', $this->techMember->id)->firstOrFail();
        $this->assertEquals('laravel_react_cv.txt', $resume->original_name);
        $this->assertNotNull($resume->assessment_completed_at);
        $this->assertEquals(5, $resume->strengths_assessment['technical_engineering']);
        $this->assertEquals(['Web & System Setup'], $resume->preferred_task_categories);
        $this->assertEquals('Lead or Independent', $resume->leadership_readiness);
        $this->assertEquals('6-10 hrs/week', $resume->availability_hours);
        $this->assertEquals('Built React dashboards for accreditation.', $resume->deliberation_notes);
        $this->assertEquals(
            ['CarSU Institutional Leadership Certificate'],
            $resume->raw_ai_analysis['cv_certifications'] ?? []
        );
        $this->assertContains('CarSU Institutional Leadership Certificate', $resume->certifications);
        $this->assertContains('Self Entered Cert', $resume->certifications);
        $this->assertContains('Laravel', $resume->extracted_skills);
        $this->assertContains('Technical & Web Engineering', $resume->extracted_skills);
        $this->assertContains('Web & System Setup', $resume->extracted_skills);

        $this->actingAs($this->techMember)
            ->getJson(route('users.resume.show', ['user' => $this->techMember->id]))
            ->assertStatus(200)
            ->assertJson([
                'has_resume' => true,
                'has_questionnaire' => true,
                'original_name' => 'laravel_react_cv.txt',
                'leadership_readiness' => 'Lead or Independent',
                'availability_hours' => '6-10 hrs/week',
                'deliberation_notes' => 'Built React dashboards for accreditation.',
            ]);

        // Subsequent questionnaire edit preserves cv_certifications without locking self-entered certs
        $this->actingAs($this->techMember)
            ->postJson(route('eligibility-profile.store'), [
                'strength_ratings' => [
                    'technical_engineering' => 5,
                    'quality_assurance' => 4,
                ],
                'preferred_task_categories' => ['Web & System Setup'],
                'certifications_list' => ['Updated Self Cert'],
                'leadership_readiness' => 'Lead or Independent',
                'availability_hours' => '6-10 hrs/week',
                'deliberation_notes' => 'Built React dashboards for accreditation.',
            ])
            ->assertStatus(200);

        $refreshed = $resume->fresh();
        $this->assertEquals(
            ['CarSU Institutional Leadership Certificate', 'Updated Self Cert'],
            $refreshed->certifications
        );
    }

    public function test_recommend_assignees_authorizes_roles_and_scopes_candidates_accurately(): void
    {
        Http::fake(['127.0.0.1:11434/*' => Http::response([], 503)]);

        $service = new OllamaResumeScreeningService();
        $service->saveQuestionnaireProfile($this->techMember, [
            'strength_ratings' => ['technical_engineering' => 5, 'quality_assurance' => 4],
            'preferred_task_categories' => ['Web & System Setup'],
            'certifications_list' => ['Laravel Certified'],
            'leadership_readiness' => 'Lead or Independent',
            'availability_hours' => '6-10 hrs/week',
            'deliberation_notes' => 'Built React dashboards and REST APIs.',
        ]);
        $service->saveQuestionnaireProfile($this->docsMember, [
            'strength_ratings' => ['documentation_secretariat' => 5, 'technical_engineering' => 1],
            'preferred_task_categories' => ['Documentation & Minutes'],
            'certifications_list' => ['Secretariat Training'],
            'leadership_readiness' => 'Support Role',
            'availability_hours' => '3-5 hrs/week',
            'deliberation_notes' => 'Prepared minutes and MOV binders.',
        ]);

        $committeeChair = User::factory()->create(['name' => 'Tech Chair', 'email_verified_at' => now()]);
        $committeeCoChair = User::factory()->create(['name' => 'Tech CoChair', 'email_verified_at' => now()]);
        $eventCoChair = User::factory()->create(['name' => 'Event CoChair', 'email_verified_at' => now()]);
        $otherCommitteeChair = User::factory()->create(['name' => 'Other Chair', 'email_verified_at' => now()]);
        $otherCommitteeMember = User::factory()->create(['name' => 'Other Member', 'email_verified_at' => now()]);
        $unverifiedMember = User::factory()->create(['name' => 'Unverified Member', 'email_verified_at' => null]);
        $outsider = User::factory()->create(['name' => 'External Outsider', 'email_verified_at' => now()]);

        ProjectRoleAssignment::create([
            'project_id' => $this->project->id,
            'committee_id' => $this->committee->id,
            'user_id' => $committeeChair->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_STAFF,
        ]);
        ProjectRoleAssignment::create([
            'project_id' => $this->project->id,
            'committee_id' => $this->committee->id,
            'user_id' => $committeeCoChair->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_MEMBER,
        ]);
        CoChairDesignation::create([
            'project_id' => $this->project->id,
            'committee_id' => $this->committee->id,
            'user_id' => $committeeCoChair->id,
            'designated_by' => $this->leader->id,
        ]);
        ProjectRoleAssignment::create([
            'project_id' => $this->project->id,
            'committee_id' => null,
            'user_id' => $eventCoChair->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_MEMBER,
        ]);
        CoChairDesignation::create([
            'project_id' => $this->project->id,
            'committee_id' => null,
            'user_id' => $eventCoChair->id,
            'designated_by' => $this->leader->id,
        ]);
        ProjectRoleAssignment::create([
            'project_id' => $this->project->id,
            'committee_id' => $this->committee->id,
            'user_id' => $unverifiedMember->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_MEMBER,
        ]);

        $otherCommittee = Committee::create([
            'project_id' => $this->project->id,
            'name' => 'Hospitality & Logistics Committee',
            'description' => 'Venue and food coordination.',
        ]);
        ProjectRoleAssignment::create([
            'project_id' => $this->project->id,
            'committee_id' => $otherCommittee->id,
            'user_id' => $otherCommitteeChair->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_STAFF,
        ]);
        ProjectRoleAssignment::create([
            'project_id' => $this->project->id,
            'committee_id' => $otherCommittee->id,
            'user_id' => $otherCommitteeMember->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_MEMBER,
        ]);

        $foreignProject = Project::create([
            'created_by' => $outsider->id,
            'title' => 'Foreign Project',
            'status' => Project::STATUS_ACTIVE,
        ]);
        $foreignCommittee = Committee::create([
            'project_id' => $foreignProject->id,
            'name' => 'Foreign Committee',
        ]);

        $endpoint = route('projects.tasks.recommend-assignees', ['project' => $this->project->id]);

        // Leader with committee_id gets 200, scoped to verified users in target committee
        $leaderResponse = $this->actingAs($this->leader)
            ->postJson($endpoint, [
                'task_title' => 'Build React API Data Table',
                'task_description' => 'Develop React table component and endpoint integration.',
                'committee_id' => $this->committee->id,
            ])
            ->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'ollama_active',
                'recommendations' => [
                    '*' => [
                        'user_id',
                        'name',
                        'suitability_score',
                        'eligibility_status',
                        'recommendation_reason',
                        'has_resume',
                        'has_questionnaire',
                        'top_strengths',
                    ],
                ],
            ]);

        $committeeCandidateIds = collect($leaderResponse->json('recommendations'))->pluck('user_id')->all();
        $this->assertEquals($this->techMember->id, $committeeCandidateIds[0]);
        $this->assertContains($this->docsMember->id, $committeeCandidateIds);
        $this->assertNotContains($otherCommitteeMember->id, $committeeCandidateIds);
        $this->assertNotContains($unverifiedMember->id, $committeeCandidateIds);
        $this->assertNotContains($outsider->id, $committeeCandidateIds);

        // Leader without committee_id scopes across all verified project personnel
        $projectWideResponse = $this->actingAs($this->leader)
            ->postJson($endpoint, [
                'task_title' => 'Build React API Data Table',
                'task_description' => 'Develop React table component.',
            ])
            ->assertStatus(200);
        $projectWideIds = collect($projectWideResponse->json('recommendations'))->pluck('user_id')->all();
        $this->assertContains($otherCommitteeMember->id, $projectWideIds);
        $this->assertNotContains($unverifiedMember->id, $projectWideIds);

        // Event Co-Chair, Committee Chair, and Committee Co-Chair are authorized (200)
        $this->actingAs($eventCoChair)->postJson($endpoint, [
            'task_title' => 'Build React API Data Table',
        ])->assertStatus(200);

        $this->actingAs($committeeChair)->postJson($endpoint, [
            'task_title' => 'Build React API Data Table',
            'committee_id' => $this->committee->id,
        ])->assertStatus(200);

        $this->actingAs($committeeCoChair)->postJson($endpoint, [
            'task_title' => 'Build React API Data Table',
            'committee_id' => $this->committee->id,
        ])->assertStatus(200);

        // Cross-committee chair cannot request recommendations for another committee (403)
        $this->actingAs($otherCommitteeChair)->postJson($endpoint, [
            'task_title' => 'Build React API Data Table',
            'committee_id' => $this->committee->id,
        ])->assertStatus(403);

        // Regular member and external outsider receive 403
        $this->actingAs($this->techMember)->postJson($endpoint, [
            'task_title' => 'Build React API Data Table',
            'committee_id' => $this->committee->id,
        ])->assertStatus(403);

        $this->actingAs($this->techMember)->postJson($endpoint, [
            'task_title' => 'Build React API Data Table',
        ])->assertStatus(403);

        $this->actingAs($outsider)->postJson($endpoint, [
            'task_title' => 'Build React API Data Table',
            'committee_id' => $this->committee->id,
        ])->assertStatus(403);

        // Unauthorized callers cannot probe validation (422) or foreign committee existence (404)
        $this->actingAs($outsider)->postJson($endpoint, [])->assertStatus(403);
        $this->actingAs($outsider)->postJson($endpoint, [
            'task_title' => 'Probe Foreign Committee',
            'committee_id' => $foreignCommittee->id,
        ])->assertStatus(403);
        $this->actingAs($outsider)->postJson($endpoint, [
            'committee_id' => 999999,
        ])->assertStatus(403);
        $this->actingAs($this->techMember)->postJson($endpoint, [
            'committee_id' => $foreignCommittee->id,
        ])->assertStatus(403);

        // Mismatched committee from another project returns 404 for authorized leader
        $this->actingAs($this->leader)->postJson($endpoint, [
            'task_title' => 'Build React API Data Table',
            'committee_id' => $foreignCommittee->id,
        ])->assertStatus(404);

        // Validation requires task_title for authorized leader
        $this->actingAs($this->leader)->postJson($endpoint, [
            'committee_id' => $this->committee->id,
        ])->assertStatus(422)->assertJsonValidationErrors(['task_title']);
    }

    public function test_resume_show_enforces_ownership_admin_or_shared_project_leadership(): void
    {
        $service = new OllamaResumeScreeningService();
        $service->saveQuestionnaireProfile($this->techMember, [
            'strength_ratings' => ['technical_engineering' => 5],
            'preferred_task_categories' => ['Web & System Setup'],
            'certifications_list' => ['Laravel Certified'],
            'leadership_readiness' => 'Lead or Independent',
            'availability_hours' => '6-10 hrs/week',
            'deliberation_notes' => 'Private deliberation note for leader review.',
        ]);

        $admin = User::factory()->create(['is_admin' => true, 'email_verified_at' => now()]);
        $outsider = User::factory()->create(['email_verified_at' => now()]);
        $committeeStaff = User::factory()->create(['email_verified_at' => now()]);

        ProjectRoleAssignment::create([
            'project_id' => $this->project->id,
            'committee_id' => $this->committee->id,
            'user_id' => $committeeStaff->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_STAFF,
        ]);

        $showUrl = route('users.resume.show', ['user' => $this->techMember->id]);

        // Owner, Admin, shared Project Leader, and shared Committee Staff get 200
        $this->actingAs($this->techMember)
            ->getJson($showUrl)
            ->assertStatus(200)
            ->assertJsonPath('deliberation_notes', 'Private deliberation note for leader review.');

        $this->actingAs($admin)
            ->getJson($showUrl)
            ->assertStatus(200)
            ->assertJsonPath('availability_hours', '6-10 hrs/week');

        $this->actingAs($this->leader)
            ->getJson($showUrl)
            ->assertStatus(200)
            ->assertJsonPath('has_questionnaire', true);

        $this->actingAs($committeeStaff)
            ->getJson($showUrl)
            ->assertStatus(200)
            ->assertJsonPath('has_questionnaire', true);

        // Unrelated peer (plain member) and external outsider receive 403
        $this->actingAs($this->docsMember)
            ->getJson($showUrl)
            ->assertStatus(403);

        $this->actingAs($outsider)
            ->getJson($showUrl)
            ->assertStatus(403);
    }

    public function test_normalize_string_list_skips_nested_arrays_and_is_available_is_memoized(): void
    {
        Http::fake([
            '127.0.0.1:11434/api/tags' => Http::response(['models' => []], 200),
        ]);

        $service = new OllamaResumeScreeningService();

        $this->assertSame(
            ['Laravel', '42', 'React'],
            $service->normalizeStringList([' Laravel ', ['nested'], 42, '', null, 'React', 'Laravel'])
        );

        $this->assertTrue($service->isAvailable());
        $this->assertTrue($service->isAvailable());

        Http::assertSentCount(1);
    }
}
