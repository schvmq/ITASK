<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\ProjectApprovalDocument;
use App\Models\ProjectRoleAssignment;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ProjectWorkflowE2ETest extends TestCase
{
    protected function createVerifiedUser(array $attributes = []): User
    {
        $user = User::create(array_merge([
            'name' => 'Faculty User',
            'email' => 'user_' . uniqid() . '@carsu.edu.ph',
            'password' => 'SecurePass123!',
        ], $attributes));

        $user->forceFill(['email_verified_at' => now()])->save();

        return $user;
    }

    protected function createFakeDocument(string $name = 'memo.pdf', int $kilobytes = 200, string $mime = 'application/pdf'): UploadedFile
    {
        return UploadedFile::fake()->create($name, $kilobytes, $mime);
    }

    /**
     * Test 1: Complete end-to-end user workflow:
     * Project List -> Create Project -> Project Detail -> Edit Project -> Upload Approval Document -> View -> Download -> Project List
     */
    public function test_complete_project_lifecycle_workflow(): void
    {
        Storage::fake('local');

        $leader = $this->createVerifiedUser([
            'name' => 'Dr. Eleanor Vance',
            'email' => 'eleanor.vance_' . uniqid() . '@carsu.edu.ph',
        ]);

        // Step 1: User visits Project List
        $listResponse = $this->actingAs($leader)->get('/projects');
        $listResponse->assertStatus(200);
        $listResponse->assertInertia(fn (Assert $page) => $page
            ->component('Projects/Index')
            ->has('projects')
        );

        // Step 2: User creates a new project with valid approval document
        $initialDoc = $this->createFakeDocument('charter_approval.pdf', 350, 'application/pdf');
        $createResponse = $this->actingAs($leader)->post('/projects', [
            'title' => 'Autonomous Robotics Laboratory 2026',
            'description' => 'Procurement and development of robotics equipment and curriculum.',
            'status' => Project::STATUS_PLANNING,
            'start_date' => '2026-10-01',
            'end_date' => '2027-04-30',
            'approval_document' => $initialDoc,
        ]);

        // Assert database persistence
        $this->assertDatabaseHas('projects', [
            'title' => 'Autonomous Robotics Laboratory 2026',
            'status' => Project::STATUS_PLANNING,
            'created_by' => $leader->id,
        ]);

        $project = Project::where('title', 'Autonomous Robotics Laboratory 2026')->firstOrFail();

        // Assert redirect to Project Detail and flash message
        $createResponse->assertRedirect("/projects/{$project->id}");
        $createResponse->assertSessionHas('status', 'Project created successfully.');

        // Assert Project Leader role assignment was automatically created
        $this->assertDatabaseHas('project_role_assignments', [
            'project_id' => $project->id,
            'user_id' => $leader->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_LEADER,
        ]);

        // Assert approval document was saved in database and storage
        $this->assertDatabaseHas('project_approval_documents', [
            'project_id' => $project->id,
            'original_name' => 'charter_approval.pdf',
            'uploaded_by' => $leader->id,
        ]);

        $firstDoc = $project->approvalDocuments()->firstOrFail();
        Storage::disk('local')->assertExists($firstDoc->file_path);

        // Step 3: User views Project Detail
        $detailResponse = $this->actingAs($leader)->get("/projects/{$project->id}");
        $detailResponse->assertStatus(200);
        $detailResponse->assertInertia(fn (Assert $page) => $page
            ->component('Projects/Show')
            ->where('project.id', (string) $project->id)
            ->where('project.title', 'Autonomous Robotics Laboratory 2026')
            ->where('project.status', Project::STATUS_PLANNING)
            ->where('project.leader.name', 'Dr. Eleanor Vance')
            ->where('project.can.update', true)
            ->where('project.can.uploadDocument', true)
            ->has('project.documents', 1)
            ->where('project.documents.0.original_name', 'charter_approval.pdf')
        );

        // Step 4: User edits the project (updating title, status, and description)
        $editResponse = $this->actingAs($leader)->patch("/projects/{$project->id}", [
            'title' => 'Autonomous Robotics Laboratory 2026 — Phase 1',
            'description' => 'Updated procurement schedule and lab readiness protocol.',
            'status' => Project::STATUS_ACTIVE,
            'start_date' => '2026-10-01',
            'end_date' => '2027-05-15',
        ]);

        $editResponse->assertRedirect();
        $editResponse->assertSessionHas('status', 'Project updated successfully.');

        // Verify update persisted in database
        $project->refresh();
        $this->assertEquals('Autonomous Robotics Laboratory 2026 — Phase 1', $project->title);
        $this->assertEquals(Project::STATUS_ACTIVE, $project->status);
        $this->assertEquals('Updated procurement schedule and lab readiness protocol.', $project->description);

        // Verify updated values display on Project Detail page
        $updatedDetailResponse = $this->actingAs($leader)->get("/projects/{$project->id}");
        $updatedDetailResponse->assertStatus(200);
        $updatedDetailResponse->assertInertia(fn (Assert $page) => $page
            ->component('Projects/Show')
            ->where('project.title', 'Autonomous Robotics Laboratory 2026 — Phase 1')
            ->where('project.status', Project::STATUS_ACTIVE)
        );

        // Step 5: Project Leader uploads an additional approval document
        $secondDoc = $this->createFakeDocument('supplemental_budget_approval.pdf', 500, 'application/pdf');
        $uploadResponse = $this->actingAs($leader)->post("/projects/{$project->id}/documents", [
            'approval_document' => $secondDoc,
        ]);

        $uploadResponse->assertRedirect();
        $uploadResponse->assertSessionHas('status', 'Document uploaded successfully.');

        // Verify second document persisted in database and storage
        $this->assertDatabaseCount('project_approval_documents', 2);
        $secondDocRecord = ProjectApprovalDocument::where('original_name', 'supplemental_budget_approval.pdf')->firstOrFail();
        Storage::disk('local')->assertExists($secondDocRecord->file_path);

        // Verify both documents appear in Project Detail
        $detailWithTwoDocs = $this->actingAs($leader)->get("/projects/{$project->id}");
        $detailWithTwoDocs->assertInertia(fn (Assert $page) => $page
            ->component('Projects/Show')
            ->has('project.documents', 2)
        );

        // Step 6: View document inline
        $viewResponse = $this->actingAs($leader)->get("/projects/{$project->id}/documents/{$secondDocRecord->id}?inline=1");
        $viewResponse->assertStatus(200);
        $contentDisposition = $viewResponse->headers->get('content-disposition');
        $this->assertNotNull($contentDisposition);
        $this->assertStringContainsString('inline', $contentDisposition);
        $this->assertStringContainsString('supplemental_budget_approval.pdf', $contentDisposition);

        // Step 7: Download document as attachment
        $downloadResponse = $this->actingAs($leader)->get("/projects/{$project->id}/documents/{$secondDocRecord->id}");
        $downloadResponse->assertStatus(200);
        $dlDisposition = $downloadResponse->headers->get('content-disposition');
        $this->assertNotNull($dlDisposition);
        $this->assertStringContainsString('attachment', $dlDisposition);
        $this->assertStringContainsString('supplemental_budget_approval.pdf', $dlDisposition);

        // Step 8: Return to Project List and verify updated project is present
        $finalListResponse = $this->actingAs($leader)->get('/projects');
        $finalListResponse->assertStatus(200);
        $finalListResponse->assertInertia(fn (Assert $page) => $page
            ->component('Projects/Index')
            ->where('projects.0.title', 'Autonomous Robotics Laboratory 2026 — Phase 1')
            ->where('projects.0.status', Project::STATUS_ACTIVE)
        );
    }

    /**
     * Test 2: Role Authorization verification across Project Leader, Project Staff, and Project Member.
     */
    public function test_three_role_authorization_enforcement(): void
    {
        Storage::fake('local');

        $leader = $this->createVerifiedUser(['name' => 'Project Leader User']);
        $staff = $this->createVerifiedUser(['name' => 'Project Staff User']);
        $member = $this->createVerifiedUser(['name' => 'Project Member User']);
        $outsider = $this->createVerifiedUser(['name' => 'Unassigned Faculty']);

        $project = Project::create([
            'title' => 'Security Audit 2026',
            'status' => Project::STATUS_ACTIVE,
            'created_by' => $leader->id,
        ]);

        ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'user_id' => $leader->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_LEADER,
        ]);

        ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'user_id' => $staff->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_STAFF,
        ]);

        ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'user_id' => $member->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_MEMBER,
        ]);

        $docPath = 'project_approvals/' . $project->id . '/test_doc.pdf';
        Storage::disk('local')->put($docPath, '%PDF-1.4 test content');

        $doc = ProjectApprovalDocument::create([
            'project_id' => $project->id,
            'file_path' => $docPath,
            'original_name' => 'security_audit_auth.pdf',
            'mime_type' => 'application/pdf',
            'file_size' => 1024,
            'uploaded_by' => $leader->id,
        ]);

        // Leader permissions:
        $this->actingAs($leader)->get("/projects/{$project->id}")->assertOk()->assertInertia(fn (Assert $p) => $p
            ->where('project.can.update', true)
            ->where('project.can.uploadDocument', true)
        );
        $this->actingAs($leader)->patch("/projects/{$project->id}", ['title' => 'Security Audit 2026 Updated'])->assertRedirect();
        $this->actingAs($leader)->post("/projects/{$project->id}/documents", ['approval_document' => $this->createFakeDocument()])->assertRedirect();
        $this->actingAs($leader)->get("/projects/{$project->id}/documents/{$doc->id}")->assertOk();

        // Staff permissions: can view/download, CANNOT edit, CANNOT upload document
        $this->actingAs($staff)->get("/projects/{$project->id}")->assertOk()->assertInertia(fn (Assert $p) => $p
            ->where('project.can.update', false)
            ->where('project.can.uploadDocument', false)
        );
        $this->actingAs($staff)->patch("/projects/{$project->id}", ['title' => 'Staff Edit Attempt'])->assertForbidden();
        $this->actingAs($staff)->post("/projects/{$project->id}/documents", ['approval_document' => $this->createFakeDocument()])->assertForbidden();
        $this->actingAs($staff)->get("/projects/{$project->id}/documents/{$doc->id}")->assertOk();

        // Member permissions: can view/download, CANNOT edit, CANNOT upload document
        $this->actingAs($member)->get("/projects/{$project->id}")->assertOk()->assertInertia(fn (Assert $p) => $p
            ->where('project.can.update', false)
            ->where('project.can.uploadDocument', false)
        );
        $this->actingAs($member)->patch("/projects/{$project->id}", ['title' => 'Member Edit Attempt'])->assertForbidden();
        $this->actingAs($member)->post("/projects/{$project->id}/documents", ['approval_document' => $this->createFakeDocument()])->assertForbidden();
        $this->actingAs($member)->get("/projects/{$project->id}/documents/{$doc->id}")->assertOk();

        // Unassigned user: CANNOT view, CANNOT edit, CANNOT upload, CANNOT download
        $this->actingAs($outsider)->get("/projects/{$project->id}")->assertForbidden();
        $this->actingAs($outsider)->patch("/projects/{$project->id}", ['title' => 'Outsider Edit Attempt'])->assertForbidden();
        $this->actingAs($outsider)->post("/projects/{$project->id}/documents", ['approval_document' => $this->createFakeDocument()])->assertForbidden();
        $this->actingAs($outsider)->get("/projects/{$project->id}/documents/{$doc->id}")->assertForbidden();
    }

    /**
     * Test 3: Validation failure handling for Create, Edit, and Upload.
     */
    public function test_validation_errors_prevent_state_corruption(): void
    {
        Storage::fake('local');
        $leader = $this->createVerifiedUser();

        // 3a. Create Project: Missing title
        $responseMissingTitle = $this->actingAs($leader)->post('/projects', [
            'approval_document' => $this->createFakeDocument(),
        ]);
        $responseMissingTitle->assertSessionHasErrors(['title']);

        // 3b. Create Project: Invalid date range (end before start)
        $responseInvalidDates = $this->actingAs($leader)->post('/projects', [
            'title' => 'Invalid Dates Project',
            'start_date' => '2026-12-01',
            'end_date' => '2026-10-01',
            'approval_document' => $this->createFakeDocument(),
        ]);
        $responseInvalidDates->assertSessionHasErrors(['end_date']);

        // 3c. Create Project: Missing document
        $responseMissingDoc = $this->actingAs($leader)->post('/projects', [
            'title' => 'No Doc Project',
        ]);
        $responseMissingDoc->assertSessionHasErrors(['approval_document']);

        // 3d. Create Project: Unsupported file type
        $responseBadType = $this->actingAs($leader)->post('/projects', [
            'title' => 'Bad Type Project',
            'approval_document' => UploadedFile::fake()->create('script.exe', 100, 'application/x-msdownload'),
        ]);
        $responseBadType->assertSessionHasErrors(['approval_document']);

        // 3e. Create Project: File exceeding 10MB limit
        $responseOversized = $this->actingAs($leader)->post('/projects', [
            'title' => 'Huge Doc Project',
            'approval_document' => UploadedFile::fake()->create('huge.pdf', 10241, 'application/pdf'),
        ]);
        $responseOversized->assertSessionHasErrors(['approval_document']);

        // Create a valid project for testing Edit and Upload validation
        $validProject = Project::create([
            'title' => 'Valid Base Project',
            'status' => Project::STATUS_PLANNING,
            'created_by' => $leader->id,
        ]);
        ProjectRoleAssignment::create([
            'project_id' => $validProject->id,
            'user_id' => $leader->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_LEADER,
        ]);

        // 3f. Edit Project: Empty title
        $editEmptyTitle = $this->actingAs($leader)->patch("/projects/{$validProject->id}", [
            'title' => '',
        ]);
        $editEmptyTitle->assertSessionHasErrors(['title']);

        // 3g. Edit Project: Invalid status
        $editInvalidStatus = $this->actingAs($leader)->patch("/projects/{$validProject->id}", [
            'title' => 'Updated Project Title',
            'status' => 'NonExistentStatus',
        ]);
        $editInvalidStatus->assertSessionHasErrors(['status']);

        // 3h. Upload Document: Empty submission
        $uploadNoFile = $this->actingAs($leader)->post("/projects/{$validProject->id}/documents", []);
        $uploadNoFile->assertSessionHasErrors(['approval_document']);

        // 3i. Upload Document: Unsupported file type (.txt / .sh)
        $uploadBadType = $this->actingAs($leader)->post("/projects/{$validProject->id}/documents", [
            'approval_document' => UploadedFile::fake()->create('payload.sh', 50, 'text/x-shellscript'),
        ]);
        $uploadBadType->assertSessionHasErrors(['approval_document']);

        // 3j. Upload Document: File exceeding 10MB limit
        $uploadOversized = $this->actingAs($leader)->post("/projects/{$validProject->id}/documents", [
            'approval_document' => UploadedFile::fake()->create('giant_attachment.pdf', 10241, 'application/pdf'),
        ]);
        $uploadOversized->assertSessionHasErrors(['approval_document']);
    }
}
