<?php

namespace Tests\Feature;

use App\Models\Committee;
use App\Models\MemberResume;
use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Models\User;
use App\Services\AI\OllamaResumeScreeningService;
use Illuminate\Foundation\Testing\RefreshDatabase;
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
        config(['app.env' => 'testing']);
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
            putenv('OLLAMA_HOST=http://127.0.0.1:11434');
        }
    }
}
