<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\ProjectApprovalDocument;
use App\Models\ProjectRoleAssignment;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ProjectDocumentWorkflowTest extends TestCase
{
    protected function createVerifiedUser(array $attributes = []): User
    {
        $user = User::create(array_merge([
            'name' => 'Verified User',
            'email' => 'doc_user_' . uniqid() . '@carsu.edu.ph',
            'password' => 'SecurePass123!',
        ], $attributes));

        $user->forceFill(['email_verified_at' => now()])->save();

        return $user;
    }

    protected function createProjectWithLeader(User $leader): Project
    {
        $project = Project::create([
            'title' => 'Doc Test Project ' . uniqid(),
            'description' => 'Project for document workflow testing.',
            'status' => Project::STATUS_PLANNING,
            'created_by' => $leader->id,
        ]);

        ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'user_id' => $leader->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_LEADER,
        ]);

        return $project;
    }

    protected function assignProjectRole(Project $project, User $user, string $role): ProjectRoleAssignment
    {
        return ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'user_id' => $user->id,
            'role' => $role,
        ]);
    }

    /**
     * 1. Project Leader can upload an additional approval document to their project.
     */
    public function test_project_leader_can_upload_approval_document(): void
    {
        Storage::fake('local');
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $file = UploadedFile::fake()->create('board_approval.pdf', 1024, 'application/pdf');

        $response = $this->actingAs($leader)->post("/projects/{$project->id}/documents", [
            'approval_document' => $file,
        ]);

        $response->assertRedirect("/projects/{$project->id}");
        $response->assertSessionHas('status', 'Document uploaded successfully.');

        $this->assertDatabaseHas('project_approval_documents', [
            'project_id' => $project->id,
            'uploaded_by' => $leader->id,
            'original_name' => 'board_approval.pdf',
        ]);

        $document = ProjectApprovalDocument::where('project_id', $project->id)->first();
        $this->assertNotNull($document);
        Storage::disk('local')->assertExists($document->file_path);
    }

    /**
     * 2. Uploaded document persists and appears in the project show response with can.uploadDocument = true.
     */
    public function test_uploaded_document_appears_in_project_show_page_with_permission(): void
    {
        Storage::fake('local');
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $file = UploadedFile::fake()->create('memo_v2.docx', 500, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

        $this->actingAs($leader)->post("/projects/{$project->id}/documents", [
            'approval_document' => $file,
        ]);

        $showResponse = $this->actingAs($leader)->get("/projects/{$project->id}");
        $showResponse->assertStatus(200);

        $showResponse->assertInertia(fn (Assert $page) => $page
            ->component('Projects/Show')
            ->where('project.can.uploadDocument', true)
            ->has('project.documents', 1)
            ->where('project.documents.0.original_name', 'memo_v2.docx')
            ->has('project.documents.0.download_url')
        );
    }

    /**
     * 3. Project Staff cannot upload documents (authorization denied).
     */
    public function test_project_staff_cannot_upload_document(): void
    {
        Storage::fake('local');
        $leader = $this->createVerifiedUser();
        $staff = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $this->assignProjectRole($project, $staff, ProjectRoleAssignment::ROLE_PROJECT_STAFF);

        $file = UploadedFile::fake()->create('staff_attempt.pdf', 100, 'application/pdf');

        $response = $this->actingAs($staff)->post("/projects/{$project->id}/documents", [
            'approval_document' => $file,
        ]);

        $response->assertStatus(403);
        $this->assertDatabaseMissing('project_approval_documents', [
            'original_name' => 'staff_attempt.pdf',
        ]);
    }

    /**
     * 4. Project Member cannot upload documents (authorization denied).
     */
    public function test_project_member_cannot_upload_document(): void
    {
        Storage::fake('local');
        $leader = $this->createVerifiedUser();
        $member = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $this->assignProjectRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER);

        $file = UploadedFile::fake()->create('member_attempt.pdf', 100, 'application/pdf');

        $response = $this->actingAs($member)->post("/projects/{$project->id}/documents", [
            'approval_document' => $file,
        ]);

        $response->assertStatus(403);
    }

    /**
     * 5. Unassigned verified user cannot upload documents.
     */
    public function test_unassigned_user_cannot_upload_document(): void
    {
        Storage::fake('local');
        $leader = $this->createVerifiedUser();
        $unassigned = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $file = UploadedFile::fake()->create('unassigned_attempt.pdf', 100, 'application/pdf');

        $response = $this->actingAs($unassigned)->post("/projects/{$project->id}/documents", [
            'approval_document' => $file,
        ]);

        $response->assertStatus(403);
    }

    /**
     * 6. Guest is redirected to login when attempting document upload.
     */
    public function test_guest_cannot_upload_document(): void
    {
        Storage::fake('local');
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $file = UploadedFile::fake()->create('guest_attempt.pdf', 100, 'application/pdf');

        $response = $this->post("/projects/{$project->id}/documents", [
            'approval_document' => $file,
        ]);

        $response->assertRedirect('/login');
    }

    /**
     * 7. Validation rejects missing file.
     */
    public function test_validation_rejects_missing_file(): void
    {
        Storage::fake('local');
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $response = $this->actingAs($leader)->post("/projects/{$project->id}/documents", []);

        $response->assertSessionHasErrors(['approval_document']);
    }

    /**
     * 8. Validation rejects invalid file type (e.g. .exe).
     */
    public function test_validation_rejects_invalid_file_type(): void
    {
        Storage::fake('local');
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $file = UploadedFile::fake()->create('malicious.exe', 100, 'application/x-msdownload');

        $response = $this->actingAs($leader)->post("/projects/{$project->id}/documents", [
            'approval_document' => $file,
        ]);

        $response->assertSessionHasErrors(['approval_document']);
    }

    /**
     * 9. Validation rejects oversized file (>10MB).
     */
    public function test_validation_rejects_oversized_file(): void
    {
        Storage::fake('local');
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        // 11 MB file
        $file = UploadedFile::fake()->create('huge_file.pdf', 11264, 'application/pdf');

        $response = $this->actingAs($leader)->post("/projects/{$project->id}/documents", [
            'approval_document' => $file,
        ]);

        $response->assertSessionHasErrors(['approval_document']);
    }

    /**
     * 10. View document with ?inline=1 returns inline Content-Disposition for in-browser viewing.
     */
    public function test_view_document_inline_returns_inline_disposition(): void
    {
        Storage::fake('local');
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $file = UploadedFile::fake()->create('official_memo.pdf', 200, 'application/pdf');
        $storedPath = $file->store("project_approvals/{$project->id}", 'local');

        $doc = ProjectApprovalDocument::create([
            'project_id' => $project->id,
            'uploaded_by' => $leader->id,
            'original_name' => 'official_memo.pdf',
            'file_path' => $storedPath,
            'file_size' => 200 * 1024,
            'mime_type' => 'application/pdf',
        ]);

        $response = $this->actingAs($leader)->get("/projects/{$project->id}/documents/{$doc->id}?inline=1");

        $response->assertStatus(200);
        $this->assertStringContainsString('inline', (string) $response->headers->get('content-disposition'));
        $this->assertStringContainsString('official_memo.pdf', (string) $response->headers->get('content-disposition'));
    }

    /**
     * 11. Download document without inline returns attachment Content-Disposition.
     */
    public function test_download_document_returns_attachment_disposition(): void
    {
        Storage::fake('local');
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $file = UploadedFile::fake()->create('official_memo.pdf', 200, 'application/pdf');
        $storedPath = $file->store("project_approvals/{$project->id}", 'local');

        $doc = ProjectApprovalDocument::create([
            'project_id' => $project->id,
            'uploaded_by' => $leader->id,
            'original_name' => 'official_memo.pdf',
            'file_path' => $storedPath,
            'file_size' => 200 * 1024,
            'mime_type' => 'application/pdf',
        ]);

        $response = $this->actingAs($leader)->get("/projects/{$project->id}/documents/{$doc->id}");

        $response->assertStatus(200);
        $this->assertStringContainsString('attachment', (string) $response->headers->get('content-disposition'));
    }

    /**
     * 12. Non-leader viewing the project show page sees can.uploadDocument = false.
     */
    public function test_project_staff_sees_upload_document_permission_false(): void
    {
        Storage::fake('local');
        $leader = $this->createVerifiedUser();
        $staff = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $this->assignProjectRole($project, $staff, ProjectRoleAssignment::ROLE_PROJECT_STAFF);

        $response = $this->actingAs($staff)->get("/projects/{$project->id}");
        $response->assertStatus(200);

        $response->assertInertia(fn (Assert $page) => $page
            ->component('Projects/Show')
            ->where('project.can.uploadDocument', false)
        );
    }
}
