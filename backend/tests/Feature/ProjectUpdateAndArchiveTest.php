<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\ProjectApprovalDocument;
use App\Models\ProjectRoleAssignment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ProjectUpdateAndArchiveTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Helper to create a verified user.
     */
    protected function createVerifiedUser(array $attributes = []): User
    {
        $user = User::create(array_merge([
            'name' => 'Verified User',
            'email' => 'user_' . uniqid() . '@carsu.edu.ph',
            'password' => 'SecurePass123!',
        ], $attributes));

        $user->forceFill(['email_verified_at' => now()])->save();

        return $user;
    }

    /**
     * Helper to create an unverified user.
     */
    protected function createUnverifiedUser(array $attributes = []): User
    {
        return User::create(array_merge([
            'name' => 'Unverified User',
            'email' => 'unverified_' . uniqid() . '@carsu.edu.ph',
            'password' => 'SecurePass123!',
        ], $attributes));
    }

    /**
     * Helper to create a project with an assigned Project Leader.
     */
    protected function createProjectWithLeader(User $leader, array $attributes = []): Project
    {
        $project = Project::create(array_merge([
            'title' => 'Original Project Title',
            'description' => 'Original description for testing.',
            'status' => Project::STATUS_PLANNING,
            'start_date' => '2026-10-01',
            'end_date' => '2026-10-31',
            'created_by' => $leader->id,
        ], $attributes));

        ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'user_id' => $leader->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_LEADER,
            'committee_id' => null,
        ]);

        return $project;
    }

    /**
     * Helper to assign a role to a user on a project.
     */
    protected function assignProjectRole(Project $project, User $user, string $role): ProjectRoleAssignment
    {
        return ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'user_id' => $user->id,
            'role' => $role,
            'committee_id' => null,
        ]);
    }

    /**
     * Helper to create an approval document record with an underlying fake file on local disk.
     */
    protected function createApprovalDocument(Project $project, User $uploader, string $originalName = 'approval_document.pdf'): ProjectApprovalDocument
    {
        $directory = "project_approvals/{$project->id}";
        $fakeFile = UploadedFile::fake()->create($originalName, 150, 'application/pdf');
        $storedPath = $fakeFile->store($directory, 'local');

        return ProjectApprovalDocument::create([
            'project_id' => $project->id,
            'uploaded_by' => $uploader->id,
            'original_name' => $originalName,
            'file_path' => $storedPath,
            'file_size' => $fakeFile->getSize(),
            'mime_type' => 'application/pdf',
        ]);
    }

    // =========================================================================
    // PROJECT UPDATE TESTS (1 - 9)
    // =========================================================================

    /**
     * 1. Project Leader can update their project.
     */
    public function test_project_leader_can_update_their_project(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $response = $this->actingAs($leader)->patch("/projects/{$project->id}", [
            'title' => 'Updated Project Title',
            'description' => 'Updated description content.',
            'start_date' => '2026-11-01',
            'end_date' => '2026-11-30',
            'status' => Project::STATUS_ACTIVE,
        ]);

        $response->assertRedirect(route('projects.show', $project));
        $response->assertSessionHas('status', 'Project updated successfully.');

        $this->assertDatabaseHas('projects', [
            'id' => $project->id,
            'title' => 'Updated Project Title',
            'description' => 'Updated description content.',
            'start_date' => '2026-11-01',
            'end_date' => '2026-11-30',
            'status' => Project::STATUS_ACTIVE,
        ]);
    }

    /**
     * 2. Project Staff cannot update the project.
     */
    public function test_project_staff_cannot_update_the_project(): void
    {
        $leader = $this->createVerifiedUser();
        $staff = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $this->assignProjectRole($project, $staff, ProjectRoleAssignment::ROLE_PROJECT_STAFF);

        $response = $this->actingAs($staff)->patch("/projects/{$project->id}", [
            'title' => 'Unauthorized Staff Title',
            'description' => 'Should be rejected',
        ]);

        $response->assertStatus(403);

        $this->assertDatabaseHas('projects', [
            'id' => $project->id,
            'title' => 'Original Project Title',
        ]);
    }

    /**
     * 3. Project Member cannot update the project.
     */
    public function test_project_member_cannot_update_the_project(): void
    {
        $leader = $this->createVerifiedUser();
        $member = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $this->assignProjectRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER);

        $response = $this->actingAs($member)->patch("/projects/{$project->id}", [
            'title' => 'Unauthorized Member Title',
            'description' => 'Should be rejected',
        ]);

        $response->assertStatus(403);

        $this->assertDatabaseHas('projects', [
            'id' => $project->id,
            'title' => 'Original Project Title',
        ]);
    }

    /**
     * 4. Unassigned verified user cannot update the project.
     */
    public function test_unassigned_verified_user_cannot_update_the_project(): void
    {
        $leader = $this->createVerifiedUser();
        $unassigned = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $response = $this->actingAs($unassigned)->patch("/projects/{$project->id}", [
            'title' => 'Unauthorized Unassigned Title',
            'description' => 'Should be rejected',
        ]);

        $response->assertStatus(403);

        $this->assertDatabaseHas('projects', [
            'id' => $project->id,
            'title' => 'Original Project Title',
        ]);
    }

    /**
     * 5. Guest cannot update the project.
     */
    public function test_guest_cannot_update_the_project(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $response = $this->patch("/projects/{$project->id}", [
            'title' => 'Unauthorized Guest Title',
        ]);

        $response->assertRedirect('/login');

        $this->assertDatabaseHas('projects', [
            'id' => $project->id,
            'title' => 'Original Project Title',
        ]);
    }

    /**
     * 6. Unverified user cannot update the project.
     */
    public function test_unverified_user_cannot_update_the_project(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $unverified = $this->createUnverifiedUser();

        $response = $this->actingAs($unverified)->patch("/projects/{$project->id}", [
            'title' => 'Unauthorized Unverified Title',
        ]);

        $response->assertRedirect('/verify-email');

        $this->assertDatabaseHas('projects', [
            'id' => $project->id,
            'title' => 'Original Project Title',
        ]);
    }

    /**
     * 7. Invalid update data is rejected.
     */
    public function test_invalid_update_data_is_rejected(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        // Case A: Missing / empty title
        $response1 = $this->actingAs($leader)->patch("/projects/{$project->id}", [
            'title' => '',
        ]);
        $response1->assertSessionHasErrors('title');

        // Case B: Title exceeding 255 chars
        $response2 = $this->actingAs($leader)->patch("/projects/{$project->id}", [
            'title' => str_repeat('B', 256),
        ]);
        $response2->assertSessionHasErrors('title');

        // Case C: Invalid date range (end_date before start_date)
        $response3 = $this->actingAs($leader)->patch("/projects/{$project->id}", [
            'title' => 'Date Check Project',
            'start_date' => '2026-11-20',
            'end_date' => '2026-11-10',
        ]);
        $response3->assertSessionHasErrors('end_date');

        // Case D: Invalid status value
        $response4 = $this->actingAs($leader)->patch("/projects/{$project->id}", [
            'title' => 'Status Check Project',
            'status' => 'NonExistentStatus',
        ]);
        $response4->assertSessionHasErrors('status');

        // Ensure database record was not altered by invalid submissions
        $this->assertDatabaseHas('projects', [
            'id' => $project->id,
            'title' => 'Original Project Title',
        ]);
    }

    /**
     * 8. Project ownership/leader assignment cannot be changed through the update request.
     */
    public function test_project_ownership_and_leader_assignment_cannot_be_changed_through_update_request(): void
    {
        $leader = $this->createVerifiedUser();
        $maliciousUser = $this->createVerifiedUser(['name' => 'Intruder User']);
        $project = $this->createProjectWithLeader($leader);

        $response = $this->actingAs($leader)->patch("/projects/{$project->id}", [
            'title' => 'Legitimate Title Update',
            'created_by' => $maliciousUser->id,
            'leader_id' => $maliciousUser->id,
            'user_id' => $maliciousUser->id,
            'id' => 99999,
        ]);

        $response->assertRedirect(route('projects.show', $project));

        $project->refresh();
        $this->assertSame('Legitimate Title Update', $project->title);
        $this->assertSame($leader->id, $project->created_by);

        // Confirm leader role assignment is untouched
        $leaderAssignment = ProjectRoleAssignment::where('project_id', $project->id)
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_LEADER)
            ->first();

        $this->assertNotNull($leaderAssignment);
        $this->assertSame($leader->id, $leaderAssignment->user_id);

        // Confirm malicious user was not assigned
        $maliciousAssignment = ProjectRoleAssignment::where('project_id', $project->id)
            ->where('user_id', $maliciousUser->id)
            ->first();
        $this->assertNull($maliciousAssignment);
    }

    /**
     * 9. Approval document ownership cannot be changed through the update request.
     */
    public function test_approval_document_ownership_cannot_be_changed_through_update_request(): void
    {
        Storage::fake('local');
        $leader = $this->createVerifiedUser();
        $otherUser = $this->createVerifiedUser(['name' => 'Other Person']);
        $project = $this->createProjectWithLeader($leader);
        $doc = $this->createApprovalDocument($project, $leader, 'charter_memo.pdf');

        $response = $this->actingAs($leader)->patch("/projects/{$project->id}", [
            'title' => 'Updated Project With Document',
            'uploaded_by' => $otherUser->id,
            'document_id' => 9999,
            'file_path' => 'hacked/path/evil.exe',
            'original_name' => 'spoofed.exe',
        ]);

        $response->assertRedirect(route('projects.show', $project));

        $doc->refresh();
        $this->assertSame($project->id, $doc->project_id);
        $this->assertSame($leader->id, $doc->uploaded_by);
        $this->assertSame('charter_memo.pdf', $doc->original_name);
        $this->assertStringStartsWith("project_approvals/{$project->id}/", $doc->file_path);
    }

    // =========================================================================
    // PROJECT ARCHIVE TESTS (10 - 19)
    // =========================================================================

    /**
     * 10. Project Leader can archive their project.
     */
    public function test_project_leader_can_archive_their_project(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $response = $this->actingAs($leader)->post("/projects/{$project->id}/archive");

        $response->assertRedirect(route('projects.show', $project));
        $response->assertSessionHas('status', 'Project archived successfully.');

        $project->refresh();
        $this->assertSame(Project::STATUS_ARCHIVED, $project->status);
    }

    /**
     * 11. Project Staff cannot archive the project.
     */
    public function test_project_staff_cannot_archive_the_project(): void
    {
        $leader = $this->createVerifiedUser();
        $staff = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $this->assignProjectRole($project, $staff, ProjectRoleAssignment::ROLE_PROJECT_STAFF);

        $response = $this->actingAs($staff)->post("/projects/{$project->id}/archive");

        $response->assertStatus(403);

        $project->refresh();
        $this->assertSame(Project::STATUS_PLANNING, $project->status);
    }

    /**
     * 12. Project Member cannot archive the project.
     */
    public function test_project_member_cannot_archive_the_project(): void
    {
        $leader = $this->createVerifiedUser();
        $member = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $this->assignProjectRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER);

        $response = $this->actingAs($member)->post("/projects/{$project->id}/archive");

        $response->assertStatus(403);

        $project->refresh();
        $this->assertSame(Project::STATUS_PLANNING, $project->status);
    }

    /**
     * 13. Unassigned verified user cannot archive the project.
     */
    public function test_unassigned_verified_user_cannot_archive_the_project(): void
    {
        $leader = $this->createVerifiedUser();
        $unassigned = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $response = $this->actingAs($unassigned)->post("/projects/{$project->id}/archive");

        $response->assertStatus(403);

        $project->refresh();
        $this->assertSame(Project::STATUS_PLANNING, $project->status);
    }

    /**
     * 14. Guest cannot archive the project.
     */
    public function test_guest_cannot_archive_the_project(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $response = $this->post("/projects/{$project->id}/archive");

        $response->assertRedirect('/login');

        $project->refresh();
        $this->assertSame(Project::STATUS_PLANNING, $project->status);
    }

    /**
     * 15. Unverified user cannot archive the project.
     */
    public function test_unverified_user_cannot_archive_the_project(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $unverified = $this->createUnverifiedUser();

        $response = $this->actingAs($unverified)->post("/projects/{$project->id}/archive");

        $response->assertRedirect('/verify-email');

        $project->refresh();
        $this->assertSame(Project::STATUS_PLANNING, $project->status);
    }

    /**
     * 16. Archiving preserves the project record.
     */
    public function test_archiving_preserves_the_project_record(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader, [
            'title' => 'Preserved Record Project',
            'description' => 'Preserved project details.',
        ]);

        $this->actingAs($leader)->post("/projects/{$project->id}/archive");

        $this->assertDatabaseCount('projects', 1);
        $this->assertDatabaseHas('projects', [
            'id' => $project->id,
            'title' => 'Preserved Record Project',
            'description' => 'Preserved project details.',
            'created_by' => $leader->id,
            'status' => Project::STATUS_ARCHIVED,
        ]);
    }

    /**
     * 17. Archiving does not delete the approval document.
     */
    public function test_archiving_does_not_delete_the_approval_document(): void
    {
        Storage::fake('local');
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $doc = $this->createApprovalDocument($project, $leader, 'preserve_memo.pdf');

        $this->actingAs($leader)->post("/projects/{$project->id}/archive");

        $this->assertDatabaseCount('project_approval_documents', 1);
        $this->assertDatabaseHas('project_approval_documents', [
            'id' => $doc->id,
            'project_id' => $project->id,
            'original_name' => 'preserve_memo.pdf',
        ]);

        Storage::disk('local')->assertExists($doc->file_path);
    }

    /**
     * 18. Archived project receives the appropriate existing status.
     */
    public function test_archived_project_receives_the_appropriate_existing_status(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader, ['status' => Project::STATUS_ACTIVE]);

        $this->actingAs($leader)->post("/projects/{$project->id}/archive");

        $project->refresh();
        $this->assertSame(Project::STATUS_ARCHIVED, $project->status);
        $this->assertSame('Archived', $project->status);
    }

    /**
     * 19. Repeated archive requests are handled safely.
     */
    public function test_repeated_archive_requests_are_handled_safely(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader, ['status' => Project::STATUS_ARCHIVED]);

        // Second archive attempt on an already archived project
        $response = $this->actingAs($leader)->post("/projects/{$project->id}/archive");

        $response->assertRedirect(route('projects.show', $project));
        $response->assertSessionHas('status', 'Project archived successfully.');

        $project->refresh();
        $this->assertSame(Project::STATUS_ARCHIVED, $project->status);
    }

    // =========================================================================
    // STEP 12 — DOCUMENT PRESERVATION & DOWNLOAD AFTER ARCHIVE
    // =========================================================================

    /**
     * Proves that approval document exists and remains securely downloadable after archive.
     */
    public function test_approval_document_remains_intact_and_downloadable_after_archive(): void
    {
        Storage::fake('local');
        $leader = $this->createVerifiedUser();
        $member = $this->createVerifiedUser();
        $unassigned = $this->createVerifiedUser();

        $project = $this->createProjectWithLeader($leader);
        $this->assignProjectRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER);
        $doc = $this->createApprovalDocument($project, $leader, 'official_approved_charter.pdf');

        // Archive the project
        $this->actingAs($leader)->post("/projects/{$project->id}/archive");

        // 1. Database record still exists
        $this->assertDatabaseHas('project_approval_documents', [
            'id' => $doc->id,
            'project_id' => $project->id,
        ]);

        // 2. Physical file on private disk still exists
        Storage::disk('local')->assertExists($doc->file_path);

        // 3. Leader can still securely download the document
        $leaderDownload = $this->actingAs($leader)->get("/projects/{$project->id}/documents/{$doc->id}");
        $leaderDownload->assertStatus(200);
        $leaderDownload->assertHeader('content-disposition', 'attachment; filename=official_approved_charter.pdf');

        // 4. Assigned Member can still securely download the document
        $memberDownload = $this->actingAs($member)->get("/projects/{$project->id}/documents/{$doc->id}");
        $memberDownload->assertStatus(200);

        // 5. Unassigned user is still rejected with 403 (authorization maintained)
        $unassignedDownload = $this->actingAs($unassigned)->get("/projects/{$project->id}/documents/{$doc->id}");
        $unassignedDownload->assertStatus(403);
    }
}
