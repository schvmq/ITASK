<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\ProjectApprovalDocument;
use App\Models\ProjectRoleAssignment;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ProjectCreationTest extends TestCase
{
    /**
     * Helper to create a verified user.
     */
    protected function createVerifiedUser(array $attributes = []): User
    {
        $user = User::create(array_merge([
            'name' => 'Verified Faculty',
            'email' => 'verified_' . uniqid() . '@carsu.edu.ph',
            'password' => 'SecurePass123!',
        ], $attributes));

        $user->forceFill(['email_verified_at' => now()])->save();

        return $user;
    }

    /**
     * Helper to generate a fake approval document.
     */
    protected function createFakeApprovalDocument(string $name = 'official_memo.pdf', int $kilobytes = 300, string $mime = 'application/pdf'): UploadedFile
    {
        return UploadedFile::fake()->create($name, $kilobytes, $mime);
    }

    /**
     * 1. Guest cannot create a project.
     */
    public function test_guest_cannot_create_a_project(): void
    {
        Storage::fake('local');

        $response = $this->post('/projects', [
            'title' => 'Guest Attempt Project',
            'description' => 'Should fail',
            'approval_document' => $this->createFakeApprovalDocument(),
        ]);

        $response->assertRedirect('/login');
        $this->assertDatabaseCount('projects', 0);
        $this->assertDatabaseCount('project_role_assignments', 0);
        $this->assertDatabaseCount('project_approval_documents', 0);
    }

    /**
     * 2. Unverified user cannot create a project.
     */
    public function test_unverified_user_cannot_create_a_project(): void
    {
        Storage::fake('local');

        $user = User::create([
            'name' => 'Unverified Faculty',
            'email' => 'unverified_' . uniqid() . '@carsu.edu.ph',
            'password' => 'SecurePass123!',
        ]);

        $response = $this->actingAs($user)->post('/projects', [
            'title' => 'Unverified Attempt Project',
            'description' => 'Should redirect to verify-email',
            'approval_document' => $this->createFakeApprovalDocument(),
        ]);

        $response->assertRedirect('/verify-email');
        $this->assertDatabaseCount('projects', 0);
        $this->assertDatabaseCount('project_role_assignments', 0);
        $this->assertDatabaseCount('project_approval_documents', 0);
    }

    /**
     * 3. Verified user cannot create a project without an approval document.
     */
    public function test_verified_user_cannot_create_a_project_without_an_approval_document(): void
    {
        Storage::fake('local');
        $user = $this->createVerifiedUser();

        $response = $this->actingAs($user)->post('/projects', [
            'title' => 'Project Without Document',
            'description' => 'Should fail validation',
        ]);

        $response->assertSessionHasErrors('approval_document');
        $this->assertDatabaseCount('projects', 0);
        $this->assertDatabaseCount('project_approval_documents', 0);
    }

    /**
     * 4. Valid project creation with a valid approval document succeeds.
     */
    public function test_valid_project_creation_with_valid_approval_document_succeeds(): void
    {
        Storage::fake('local');
        $user = $this->createVerifiedUser();

        $response = $this->actingAs($user)->post('/projects', [
            'title' => 'CCIS Robotics Colloquium 2026',
            'description' => 'Annual college robotics showcase and exhibition',
            'start_date' => '2026-11-01',
            'end_date' => '2026-11-15',
            'approval_document' => $this->createFakeApprovalDocument('approved_robotics_colloquium.pdf'),
        ]);

        $this->assertDatabaseHas('projects', [
            'title' => 'CCIS Robotics Colloquium 2026',
            'status' => Project::STATUS_PLANNING,
            'created_by' => $user->id,
        ]);

        $project = Project::where('title', 'CCIS Robotics Colloquium 2026')->first();
        $this->assertNotNull($project);
        $response->assertRedirect(route('projects.show', $project));
    }

    /**
     * 5. ProjectApprovalDocument record is created with correct associations and metadata.
     */
    public function test_project_approval_document_record_is_created_with_metadata(): void
    {
        Storage::fake('local');
        $user = $this->createVerifiedUser();

        $file = $this->createFakeApprovalDocument('Dean_Approved_Letter.pdf', 450, 'application/pdf');

        $this->actingAs($user)->post('/projects', [
            'title' => 'AI Ethics Framework Development',
            'description' => 'Project charter for CCIS AI policy',
            'approval_document' => $file,
        ]);

        $project = Project::where('title', 'AI Ethics Framework Development')->first();
        $this->assertNotNull($project);

        $document = ProjectApprovalDocument::where('project_id', $project->id)->first();
        $this->assertNotNull($document);

        // Association checks
        $this->assertSame($project->id, $document->project_id);
        $this->assertSame($user->id, $document->uploaded_by);
        $this->assertSame($user->id, $document->uploader->id);

        // Metadata checks
        $this->assertSame('Dean_Approved_Letter.pdf', $document->original_name);
        $this->assertGreaterThan(0, $document->file_size);
        $this->assertStringContainsString('pdf', $document->mime_type);
        $this->assertStringStartsWith("project_approvals/{$project->id}/", $document->file_path);

        // Private storage check
        Storage::disk('local')->assertExists($document->file_path);
    }

    /**
     * 6. Creator automatically receives a Project Leader assignment.
     */
    public function test_creator_automatically_receives_project_leader_assignment(): void
    {
        Storage::fake('local');
        $user = $this->createVerifiedUser();

        $this->actingAs($user)->post('/projects', [
            'title' => 'College Recognition Day 2026',
            'approval_document' => $this->createFakeApprovalDocument(),
        ]);

        $project = Project::where('title', 'College Recognition Day 2026')->first();
        $this->assertNotNull($project);

        $assignment = ProjectRoleAssignment::where('project_id', $project->id)
            ->where('user_id', $user->id)
            ->first();

        $this->assertNotNull($assignment);
        $this->assertTrue($assignment->isLeader());
        $this->assertSame(ProjectRoleAssignment::ROLE_PROJECT_LEADER, $assignment->role);
        $this->assertNull($assignment->committee_id);
    }

    /**
     * 7. Invalid project title is rejected.
     */
    public function test_invalid_project_title_is_rejected(): void
    {
        Storage::fake('local');
        $user = $this->createVerifiedUser();

        // Empty title
        $response1 = $this->actingAs($user)->post('/projects', [
            'title' => '',
            'approval_document' => $this->createFakeApprovalDocument(),
        ]);
        $response1->assertSessionHasErrors('title');

        // Title exceeding 255 characters
        $response2 = $this->actingAs($user)->post('/projects', [
            'title' => str_repeat('A', 256),
            'approval_document' => $this->createFakeApprovalDocument(),
        ]);
        $response2->assertSessionHasErrors('title');

        $this->assertDatabaseCount('projects', 0);
        $this->assertDatabaseCount('project_approval_documents', 0);
    }

    /**
     * 8. Invalid date range is rejected when end_date is before start_date.
     */
    public function test_invalid_date_range_is_rejected_when_end_date_is_before_start_date(): void
    {
        Storage::fake('local');
        $user = $this->createVerifiedUser();

        $response = $this->actingAs($user)->post('/projects', [
            'title' => 'Timeline Reversal Test',
            'start_date' => '2026-11-20',
            'end_date' => '2026-11-10', // Before start_date
            'approval_document' => $this->createFakeApprovalDocument(),
        ]);

        $response->assertSessionHasErrors('end_date');
        $this->assertDatabaseCount('projects', 0);
        $this->assertDatabaseCount('project_approval_documents', 0);
    }

    /**
     * 9. Invalid file type is rejected.
     */
    public function test_invalid_file_type_is_rejected(): void
    {
        Storage::fake('local');
        $user = $this->createVerifiedUser();

        $invalidFile = UploadedFile::fake()->create('malicious.exe', 100, 'application/x-msdownload');

        $response = $this->actingAs($user)->post('/projects', [
            'title' => 'Malicious File Test',
            'approval_document' => $invalidFile,
        ]);

        $response->assertSessionHasErrors('approval_document');
        $this->assertDatabaseCount('projects', 0);
        $this->assertDatabaseCount('project_approval_documents', 0);
    }

    /**
     * 10. Oversized file is rejected.
     */
    public function test_oversized_file_is_rejected(): void
    {
        Storage::fake('local');
        $user = $this->createVerifiedUser();

        // 15 MB file exceeds the 10 MB (10240 KB) limit
        $oversizedFile = UploadedFile::fake()->create('oversized_memo.pdf', 15360, 'application/pdf');

        $response = $this->actingAs($user)->post('/projects', [
            'title' => 'Oversized File Test',
            'approval_document' => $oversizedFile,
        ]);

        $response->assertSessionHasErrors('approval_document');
        $this->assertDatabaseCount('projects', 0);
        $this->assertDatabaseCount('project_approval_documents', 0);
    }

    /**
     * 11. Supported document formats (PDF, DOC, DOCX, JPG, PNG) are accepted.
     */
    public function test_supported_document_formats_are_accepted(): void
    {
        Storage::fake('local');
        $user = $this->createVerifiedUser();

        $formats = [
            ['filename' => 'doc1.pdf', 'mime' => 'application/pdf'],
            ['filename' => 'doc2.docx', 'mime' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
            ['filename' => 'doc3.png', 'mime' => 'image/png'],
            ['filename' => 'doc4.jpg', 'mime' => 'image/jpeg'],
        ];

        foreach ($formats as $index => $format) {
            $file = UploadedFile::fake()->create($format['filename'], 150, $format['mime']);

            $response = $this->actingAs($user)->post('/projects', [
                'title' => "Format Test Project {$index}",
                'approval_document' => $file,
            ]);

            $response->assertSessionHasNoErrors();
            $this->assertDatabaseHas('projects', ['title' => "Format Test Project {$index}"]);
        }
    }

    /**
     * 12. If project creation fails after file storage, the stored file does not remain orphaned.
     */
    public function test_if_project_creation_fails_after_file_storage_file_is_cleaned_up(): void
    {
        Storage::fake('local');
        $user = $this->createVerifiedUser();

        // Hook into ProjectApprovalDocument saving to simulate a database failure after file is written
        ProjectApprovalDocument::saving(function () {
            throw new \RuntimeException('Simulated database error during document record creation');
        });

        $file = $this->createFakeApprovalDocument('failure_test.pdf');

        try {
            $this->actingAs($user)->post('/projects', [
                'title' => 'Failure Cleanup Test',
                'approval_document' => $file,
            ]);
        } catch (\Throwable $e) {
            // Expected thrown exception from controller
        }

        // Verify that no orphaned files exist on the private disk
        $filesOnDisk = Storage::disk('local')->allFiles();
        $this->assertEmpty($filesOnDisk, 'Expected no orphaned files in private storage after failed transaction.');
        $this->assertDatabaseCount('projects', 0);
        $this->assertDatabaseCount('project_approval_documents', 0);
    }

    /**
     * 13. Project creation does not create duplicate leader assignments.
     */
    public function test_project_creation_does_not_create_duplicate_leader_assignments(): void
    {
        Storage::fake('local');
        $user = $this->createVerifiedUser();

        $this->actingAs($user)->post('/projects', [
            'title' => 'Single Leader Project',
            'approval_document' => $this->createFakeApprovalDocument(),
        ]);

        $project = Project::where('title', 'Single Leader Project')->first();

        $leaderAssignmentsCount = ProjectRoleAssignment::where('project_id', $project->id)
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_LEADER)
            ->count();

        $totalAssignmentsCount = ProjectRoleAssignment::where('project_id', $project->id)->count();

        $this->assertSame(1, $leaderAssignmentsCount);
        $this->assertSame(1, $totalAssignmentsCount);
    }
}
