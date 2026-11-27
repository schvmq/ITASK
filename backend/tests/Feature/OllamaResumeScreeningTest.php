<?php

namespace Tests\Feature;

use App\Models\Committee;
use App\Models\MemberResume;
use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Models\User;
use App\Services\AI\OllamaResumeScreeningService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class OllamaResumeScreeningTest extends TestCase
{
    use RefreshDatabase;

    protected User $leader;
    protected User $member;
    protected Project $project;
    protected Committee $committee;

    protected function setUp(): void
    {
        parent::setUp();

        $this->leader = User::factory()->create(['email_verified_at' => now()]);
        $this->member = User::factory()->create(['email_verified_at' => now()]);

        $this->project = Project::create([
            'created_by' => $this->leader->id,
            'title' => 'Annual University Accreditation 2026',
            'status' => Project::STATUS_ACTIVE,
        ]);

        ProjectRoleAssignment::create([
            'project_id' => $this->project->id,
            'user_id' => $this->leader->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_LEADER,
        ]);

        ProjectRoleAssignment::create([
            'project_id' => $this->project->id,
            'user_id' => $this->member->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_MEMBER,
        ]);

        $this->committee = Committee::create([
            'project_id' => $this->project->id,
            'name' => 'Documentation & Secretariat Committee',
            'description' => 'Responsible for PACUCOA accreditation documentation, minutes of meeting, and MOV archiving.',
        ]);
    }

    public function test_service_extracts_skills_and_evaluates_heuristically_when_offline(): void
    {
        $service = new OllamaResumeScreeningService();

        $extracted = $service->extractResumeData(
            'dummy/path/resume.txt',
            'text/plain',
            'Documentation and Secretariat Resume.pdf'
        );

        $this->assertIsArray($extracted);
        $this->assertArrayHasKey('extracted_skills', $extracted);
        $this->assertArrayHasKey('eligibility_status', $extracted);
        $this->assertContains('Documentation', $extracted['extracted_skills']);
        $this->assertEquals('Eligible', $extracted['eligibility_status']);
    }

    public function test_recommend_members_endpoint_ranks_candidates(): void
    {
        MemberResume::create([
            'user_id' => $this->member->id,
            'original_name' => 'candidate_cv.pdf',
            'file_path' => 'resumes/candidate_cv.pdf',
            'file_size' => 1024,
            'mime_type' => 'application/pdf',
            'extracted_skills' => ['Documentation', 'Secretariat', 'Technical Writing'],
            'certifications' => ['Accreditation Officer Training'],
            'experience_summary' => '3 years committee documentation lead at CarSU.',
            'eligibility_status' => 'Highly Recommended',
        ]);

        $response = $this->actingAs($this->leader)
            ->postJson(route('projects.committees.members.recommend', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
            ]));

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'success',
            'ollama_active',
            'recommendations' => [
                '*' => [
                    'user_id',
                    'name',
                    'email',
                    'has_resume',
                    'suitability_score',
                    'eligibility_status',
                    'recommendation_reason',
                    'extracted_skills',
                ],
            ],
        ]);

        $recommendations = $response->json('recommendations');
        $this->assertNotEmpty($recommendations);
        $firstMatch = $recommendations[0];
        $this->assertEquals($this->member->id, $firstMatch['user_id']);
        $this->assertTrue($firstMatch['has_resume']);
        $this->assertGreaterThanOrEqual(70, $firstMatch['suitability_score']);
    }

    public function test_member_can_upload_resume(): void
    {
        Storage::fake('local');

        $file = UploadedFile::fake()->create('my_resume.pdf', 500, 'application/pdf');

        $response = $this->actingAs($this->member)
            ->postJson(route('users.resume.upload', ['user' => $this->member->id]), [
                'resume' => $file,
            ]);

        $response->assertStatus(200);
        $response->assertJson([
            'success' => true,
        ]);

        $this->assertDatabaseHas('member_resumes', [
            'user_id' => $this->member->id,
            'original_name' => 'my_resume.pdf',
        ]);
    }
}
