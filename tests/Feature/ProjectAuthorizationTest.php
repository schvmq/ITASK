<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\ProjectApprovalDocument;
use App\Models\ProjectRoleAssignment;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ProjectAuthorizationTest extends TestCase
{
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
     * Helper to create a real project with leader assignment.
     */
    protected function createProjectWithLeader(User $leader, array $projectAttributes = []): Project
    {
        $project = Project::create(array_merge([
            'title' => 'Capstone Authorization Project ' . uniqid(),
            'description' => 'Project created for policy testing.',
            'status' => Project::STATUS_PLANNING,
            'created_by' => $leader->id,
        ], $projectAttributes));

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
    protected function createApprovalDocument(Project $project, User $uploader, string $originalName = 'approval_memo.pdf'): ProjectApprovalDocument
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
    // PROJECT VIEW TESTS (1 - 6)
    // =========================================================================

    /**
     * 1. Guest cannot view project.
     */
    public function test_guest_cannot_view_project(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $response = $this->get("/projects/{$project->id}");

        $response->assertRedirect('/login');
    }

    /**
     * 2. Unverified user cannot view project.
     */
    public function test_unverified_user_cannot_view_project(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $unverifiedUser = $this->createUnverifiedUser();

        $response = $this->actingAs($unverifiedUser)->get("/projects/{$project->id}");

        $response->assertRedirect('/verify-email');
    }

    /**
     * 3. Assigned Project Leader can view project.
     */
    public function test_assigned_project_leader_can_view_project(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $response = $this->actingAs($leader)->get("/projects/{$project->id}");

        $response->assertStatus(200);
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Projects/Show')
            ->where('project.id', (string) $project->id)
            ->where('project.role', ProjectRoleAssignment::ROLE_PROJECT_LEADER)
        );
    }

    /**
     * 4. Assigned Project Staff can view project.
     */
    public function test_assigned_project_staff_can_view_project(): void
    {
        $leader = $this->createVerifiedUser();
        $staff = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $this->assignProjectRole($project, $staff, ProjectRoleAssignment::ROLE_PROJECT_STAFF);

        $response = $this->actingAs($staff)->get("/projects/{$project->id}");

        $response->assertStatus(200);
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Projects/Show')
            ->where('project.id', (string) $project->id)
            ->where('project.role', ProjectRoleAssignment::ROLE_PROJECT_STAFF)
        );
    }

    /**
     * 5. Assigned Project Member can view project.
     */
    public function test_assigned_project_member_can_view_project(): void
    {
        $leader = $this->createVerifiedUser();
        $member = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $this->assignProjectRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER);

        $response = $this->actingAs($member)->get("/projects/{$project->id}");

        $response->assertStatus(200);
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Projects/Show')
            ->where('project.id', (string) $project->id)
            ->where('project.role', ProjectRoleAssignment::ROLE_PROJECT_MEMBER)
        );
    }

    /**
     * 6. Verified but unassigned user cannot view project.
     */
    public function test_verified_but_unassigned_user_cannot_view_project(): void
    {
        $leader = $this->createVerifiedUser();
        $unassignedUser = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $response = $this->actingAs($unassignedUser)->get("/projects/{$project->id}");

        $response->assertStatus(403);
    }

    // =========================================================================
    // PROJECT UPDATE TESTS (7 - 10)
    // =========================================================================

    /**
     * 7. Project Leader is authorized to update project.
     */
    public function test_project_leader_is_authorized_to_update_project(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $this->assertTrue(Gate::forUser($leader)->allows('update', $project));
    }

    /**
     * 8. Project Staff is denied update authorization.
     */
    public function test_project_staff_is_denied_update_authorization(): void
    {
        $leader = $this->createVerifiedUser();
        $staff = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $this->assignProjectRole($project, $staff, ProjectRoleAssignment::ROLE_PROJECT_STAFF);

        $this->assertFalse(Gate::forUser($staff)->allows('update', $project));
    }

    /**
     * 9. Project Member is denied update authorization.
     */
    public function test_project_member_is_denied_update_authorization(): void
    {
        $leader = $this->createVerifiedUser();
        $member = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $this->assignProjectRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER);

        $this->assertFalse(Gate::forUser($member)->allows('update', $project));
    }

    /**
     * 10. Unassigned user is denied update authorization.
     */
    public function test_unassigned_user_is_denied_update_authorization(): void
    {
        $leader = $this->createVerifiedUser();
        $unassigned = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $this->assertFalse(Gate::forUser($unassigned)->allows('update', $project));
    }

    // =========================================================================
    // PROJECT ARCHIVE TESTS (11 - 14)
    // =========================================================================

    /**
     * 11. Project Leader is authorized to archive.
     */
    public function test_project_leader_is_authorized_to_archive_project(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $this->assertTrue(Gate::forUser($leader)->allows('archive', $project));
    }

    /**
     * 12. Project Staff is denied archive authorization.
     */
    public function test_project_staff_is_denied_archive_authorization(): void
    {
        $leader = $this->createVerifiedUser();
        $staff = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $this->assignProjectRole($project, $staff, ProjectRoleAssignment::ROLE_PROJECT_STAFF);

        $this->assertFalse(Gate::forUser($staff)->allows('archive', $project));
    }

    /**
     * 13. Project Member is denied archive authorization.
     */
    public function test_project_member_is_denied_archive_authorization(): void
    {
        $leader = $this->createVerifiedUser();
        $member = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $this->assignProjectRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER);

        $this->assertFalse(Gate::forUser($member)->allows('archive', $project));
    }

    /**
     * 14. Unassigned user is denied archive authorization.
     */
    public function test_unassigned_user_is_denied_archive_authorization(): void
    {
        $leader = $this->createVerifiedUser();
        $unassigned = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $this->assertFalse(Gate::forUser($unassigned)->allows('archive', $project));
    }

    // =========================================================================
    // DOCUMENT DOWNLOAD TESTS (15 - 23)
    // =========================================================================

    /**
     * 15. Project Leader can download approval document.
     */
    public function test_project_leader_can_download_approval_document(): void
    {
        Storage::fake('local');
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $doc = $this->createApprovalDocument($project, $leader, 'leader_memo.pdf');

        $response = $this->actingAs($leader)->get("/projects/{$project->id}/documents/{$doc->id}");

        $response->assertStatus(200);
        $response->assertHeader('content-disposition', 'attachment; filename=leader_memo.pdf');
    }

    /**
     * 16. Assigned Project Staff can download approval document.
     */
    public function test_assigned_project_staff_can_download_approval_document(): void
    {
        Storage::fake('local');
        $leader = $this->createVerifiedUser();
        $staff = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $this->assignProjectRole($project, $staff, ProjectRoleAssignment::ROLE_PROJECT_STAFF);
        $doc = $this->createApprovalDocument($project, $leader, 'staff_accessible_doc.pdf');

        $response = $this->actingAs($staff)->get("/projects/{$project->id}/documents/{$doc->id}");

        $response->assertStatus(200);
        $response->assertHeader('content-disposition', 'attachment; filename=staff_accessible_doc.pdf');
    }

    /**
     * 17. Assigned Project Member can download approval document.
     */
    public function test_assigned_project_member_can_download_approval_document(): void
    {
        Storage::fake('local');
        $leader = $this->createVerifiedUser();
        $member = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $this->assignProjectRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER);
        $doc = $this->createApprovalDocument($project, $leader, 'member_accessible_doc.pdf');

        $response = $this->actingAs($member)->get("/projects/{$project->id}/documents/{$doc->id}");

        $response->assertStatus(200);
        $response->assertHeader('content-disposition', 'attachment; filename=member_accessible_doc.pdf');
    }

    /**
     * 18. Unassigned verified user cannot download approval document.
     */
    public function test_unassigned_verified_user_cannot_download_approval_document(): void
    {
        Storage::fake('local');
        $leader = $this->createVerifiedUser();
        $unassigned = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $doc = $this->createApprovalDocument($project, $leader);

        $response = $this->actingAs($unassigned)->get("/projects/{$project->id}/documents/{$doc->id}");

        $response->assertStatus(403);
    }

    /**
     * 19. Guest cannot download approval document.
     */
    public function test_guest_cannot_download_approval_document(): void
    {
        Storage::fake('local');
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $doc = $this->createApprovalDocument($project, $leader);

        $response = $this->get("/projects/{$project->id}/documents/{$doc->id}");

        $response->assertRedirect('/login');
    }

    /**
     * 20. Unverified user cannot download approval document.
     */
    public function test_unverified_user_cannot_download_approval_document(): void
    {
        Storage::fake('local');
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $doc = $this->createApprovalDocument($project, $leader);
        $unverified = $this->createUnverifiedUser();

        $response = $this->actingAs($unverified)->get("/projects/{$project->id}/documents/{$doc->id}");

        $response->assertRedirect('/verify-email');
    }

    /**
     * 21. User cannot access a document belonging to another project by manipulating the project/document URL.
     */
    public function test_user_cannot_access_document_belonging_to_another_project(): void
    {
        Storage::fake('local');
        $leader1 = $this->createVerifiedUser();
        $leader2 = $this->createVerifiedUser();

        $project1 = $this->createProjectWithLeader($leader1, ['title' => 'Project Alpha']);
        $project2 = $this->createProjectWithLeader($leader2, ['title' => 'Project Beta']);

        $docProject2 = $this->createApprovalDocument($project2, $leader2, 'confidential_beta.pdf');

        // Leader 1 is authorized for Project 1, but requests Document from Project 2 under Project 1 URL
        $response = $this->actingAs($leader1)->get("/projects/{$project1->id}/documents/{$docProject2->id}");

        $response->assertStatus(404);
    }

    /**
     * 22. Missing document file returns an appropriate not-found response.
     */
    public function test_missing_document_file_returns_not_found(): void
    {
        Storage::fake('local');
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        // Record exists in DB, but the file is intentionally NOT placed on fake disk
        $doc = ProjectApprovalDocument::create([
            'project_id' => $project->id,
            'uploaded_by' => $leader->id,
            'original_name' => 'ghost_file.pdf',
            'file_path' => "project_approvals/{$project->id}/missing_file.pdf",
            'file_size' => 1024,
            'mime_type' => 'application/pdf',
        ]);

        $response = $this->actingAs($leader)->get("/projects/{$project->id}/documents/{$doc->id}");

        $response->assertStatus(404);
    }

    /**
     * 23. Raw private storage path is never returned as a public URL.
     */
    public function test_raw_private_storage_path_is_never_returned_as_public_url(): void
    {
        Storage::fake('local');
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $doc = $this->createApprovalDocument($project, $leader, 'official_document.pdf');

        // 1. Check Project Detail response props
        $response = $this->actingAs($leader)->get("/projects/{$project->id}");
        $response->assertStatus(200);

        $response->assertInertia(function (Assert $page) use ($doc) {
            $page->has('project.documents.0', function (Assert $document) use ($doc) {
                $document->where('id', (string) $doc->id)
                    ->where('original_name', 'official_document.pdf')
                    ->where('download_url', route('projects.documents.download', [
                        'project' => $doc->project_id,
                        'document' => $doc->id,
                    ]))
                    ->missing('file_path') // Confirms internal file_path is never leaked
                    ->etc();
            });
        });

        // 2. Download response should be an attachment stream, not a redirect to a public URL or raw path
        $downloadResponse = $this->actingAs($leader)->get("/projects/{$project->id}/documents/{$doc->id}");
        $downloadResponse->assertStatus(200);
        $downloadResponse->assertHeader('content-disposition', 'attachment; filename=official_document.pdf');

        $this->assertStringNotContainsString('storage/app/private', (string) $downloadResponse->headers->get('content-disposition'));
        $this->assertStringNotContainsString('/storage/', (string) $downloadResponse->headers->get('content-disposition'));
    }
}
