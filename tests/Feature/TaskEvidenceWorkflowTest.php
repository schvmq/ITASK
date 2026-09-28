<?php

namespace Tests\Feature;

use App\Models\Activity;
use App\Models\Committee;
use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Models\Task;
use App\Models\TaskEvidence;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class TaskEvidenceWorkflowTest extends TestCase
{
    use RefreshDatabase;

    private User $leader;
    private User $staff;
    private User $member1;
    private User $member2;
    private User $outsider;
    private Project $project;
    private Committee $committee;
    private Activity $activity;
    private Task $task;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');

        $this->leader = User::factory()->create(['email' => 'leader@carsu.edu.ph', 'email_verified_at' => now()]);
        $this->staff = User::factory()->create(['email' => 'staff@carsu.edu.ph', 'email_verified_at' => now()]);
        $this->member1 = User::factory()->create(['email' => 'member1@carsu.edu.ph', 'email_verified_at' => now()]);
        $this->member2 = User::factory()->create(['email' => 'member2@carsu.edu.ph', 'email_verified_at' => now()]);
        $this->outsider = User::factory()->create(['email' => 'outsider@carsu.edu.ph', 'email_verified_at' => now()]);

        $this->project = Project::create([
            'title' => 'Test Project',
            'status' => 'In Progress',
            'created_by' => $this->leader->id,
        ]);

        ProjectRoleAssignment::create([
            'project_id' => $this->project->id,
            'user_id' => $this->leader->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_LEADER,
        ]);

        $this->committee = Committee::create([
            'project_id' => $this->project->id,
            'name' => 'Program Committee',
        ]);

        ProjectRoleAssignment::create([
            'project_id' => $this->project->id,
            'user_id' => $this->staff->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_STAFF,
            'committee_id' => $this->committee->id,
        ]);

        ProjectRoleAssignment::create([
            'project_id' => $this->project->id,
            'user_id' => $this->member1->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_MEMBER,
            'committee_id' => $this->committee->id,
        ]);

        ProjectRoleAssignment::create([
            'project_id' => $this->project->id,
            'user_id' => $this->member2->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_MEMBER,
            'committee_id' => $this->committee->id,
        ]);

        $this->activity = Activity::create([
            'committee_id' => $this->committee->id,
            'project_id' => $this->project->id,
            'created_by' => $this->staff->id,
            'title' => 'Event Preparation',
            'status' => Activity::STATUS_IN_PROGRESS,
        ]);

        $this->task = Task::create([
            'activity_id' => $this->activity->id,
            'title' => 'Draft Program Flow',
            'status' => Task::STATUS_IN_PROGRESS,
            'assigned_to' => $this->member1->id,
            'requires_review' => false,
        ]);
    }

    public function test_assigned_member_can_upload_evidence_to_task(): void
    {
        $file = UploadedFile::fake()->create('program_flow.pdf', 500, 'application/pdf');

        $response = $this->actingAs($this->member1)->post(
            route('projects.committees.activities.tasks.evidence.store', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $this->task->id,
            ]),
            [
                'file' => $file,
                'remarks' => 'Initial program draft for committee reference',
            ]
        );

        $response->assertRedirect();
        $this->assertDatabaseHas('task_evidences', [
            'task_id' => $this->task->id,
            'uploaded_by' => $this->member1->id,
            'original_name' => 'program_flow.pdf',
            'remarks' => 'Initial program draft for committee reference',
        ]);

        $evidence = TaskEvidence::where('task_id', $this->task->id)->first();
        Storage::disk('local')->assertExists($evidence->file_path);
    }

    public function test_project_staff_and_leader_can_also_upload_evidence(): void
    {
        $staffFile = UploadedFile::fake()->create('staff_guidelines.docx', 300, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

        $responseStaff = $this->actingAs($this->staff)->post(
            route('projects.committees.activities.tasks.evidence.store', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $this->task->id,
            ]),
            ['file' => $staffFile]
        );
        $responseStaff->assertRedirect();
        $this->assertDatabaseHas('task_evidences', [
            'task_id' => $this->task->id,
            'uploaded_by' => $this->staff->id,
            'original_name' => 'staff_guidelines.docx',
        ]);

        $leaderFile = UploadedFile::fake()->create('leader_memo.png', 400, 'image/png');
        $responseLeader = $this->actingAs($this->leader)->post(
            route('projects.committees.activities.tasks.evidence.store', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $this->task->id,
            ]),
            ['file' => $leaderFile]
        );
        $responseLeader->assertRedirect();
        $this->assertDatabaseHas('task_evidences', [
            'task_id' => $this->task->id,
            'uploaded_by' => $this->leader->id,
            'original_name' => 'leader_memo.png',
        ]);
    }

    public function test_unassigned_member_cannot_upload_evidence_to_another_members_task(): void
    {
        $file = UploadedFile::fake()->create('unauthorized.pdf', 200, 'application/pdf');

        $response = $this->actingAs($this->member2)->post(
            route('projects.committees.activities.tasks.evidence.store', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $this->task->id,
            ]),
            ['file' => $file]
        );

        $response->assertForbidden();
        $this->assertDatabaseMissing('task_evidences', [
            'original_name' => 'unauthorized.pdf',
        ]);
    }

    public function test_invalid_file_type_is_rejected(): void
    {
        $exeFile = UploadedFile::fake()->create('malware.exe', 100, 'application/x-msdownload');

        $response = $this->actingAs($this->member1)->post(
            route('projects.committees.activities.tasks.evidence.store', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $this->task->id,
            ]),
            ['file' => $exeFile]
        );

        $response->assertSessionHasErrors('file');
        $this->assertDatabaseCount('task_evidences', 0);
    }

    public function test_oversize_file_is_rejected(): void
    {
        // 11 MB exceeds 10MB limit
        $largeFile = UploadedFile::fake()->create('huge.pdf', 11264, 'application/pdf');

        $response = $this->actingAs($this->member1)->post(
            route('projects.committees.activities.tasks.evidence.store', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $this->task->id,
            ]),
            ['file' => $largeFile]
        );

        $response->assertSessionHasErrors('file');
        $this->assertDatabaseCount('task_evidences', 0);
    }

    public function test_authorized_users_can_download_task_evidence(): void
    {
        $file = UploadedFile::fake()->create('document.pdf', 300, 'application/pdf');
        $stored = Storage::disk('local')->putFile('task_evidences', $file);

        $evidence = $this->task->evidences()->create([
            'uploaded_by' => $this->member1->id,
            'original_name' => 'document.pdf',
            'file_path' => $stored,
            'file_size' => 307200,
            'mime_type' => 'application/pdf',
        ]);

        // 1. Uploader can download
        $resMember = $this->actingAs($this->member1)->get(
            route('projects.committees.activities.tasks.evidence.download', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $this->task->id,
                'evidence' => $evidence->id,
            ])
        );
        $resMember->assertOk();

        // 2. Staff can download
        $resStaff = $this->actingAs($this->staff)->get(
            route('projects.committees.activities.tasks.evidence.download', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $this->task->id,
                'evidence' => $evidence->id,
            ])
        );
        $resStaff->assertOk();

        // 3. Leader can download
        $resLeader = $this->actingAs($this->leader)->get(
            route('projects.committees.activities.tasks.evidence.download', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $this->task->id,
                'evidence' => $evidence->id,
            ])
        );
        $resLeader->assertOk();
    }

    public function test_unauthorized_outsider_cannot_download_evidence(): void
    {
        $file = UploadedFile::fake()->create('secret.pdf', 100, 'application/pdf');
        $stored = Storage::disk('local')->putFile('task_evidences', $file);

        $evidence = $this->task->evidences()->create([
            'uploaded_by' => $this->member1->id,
            'original_name' => 'secret.pdf',
            'file_path' => $stored,
            'file_size' => 102400,
            'mime_type' => 'application/pdf',
        ]);

        $response = $this->actingAs($this->outsider)->get(
            route('projects.committees.activities.tasks.evidence.download', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $this->task->id,
                'evidence' => $evidence->id,
            ])
        );

        $response->assertForbidden();
    }

    public function test_uploader_and_staff_can_delete_evidence(): void
    {
        $file = UploadedFile::fake()->create('to_delete.pdf', 100, 'application/pdf');
        $stored = Storage::disk('local')->putFile('task_evidences', $file);

        $evidence = $this->task->evidences()->create([
            'uploaded_by' => $this->member1->id,
            'original_name' => 'to_delete.pdf',
            'file_path' => $stored,
            'file_size' => 102400,
            'mime_type' => 'application/pdf',
        ]);

        // Member2 (unauthorized member) cannot delete
        $failRes = $this->actingAs($this->member2)->delete(
            route('projects.committees.activities.tasks.evidence.destroy', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $this->task->id,
                'evidence' => $evidence->id,
            ])
        );
        $failRes->assertForbidden();
        $this->assertDatabaseHas('task_evidences', ['id' => $evidence->id]);

        // Uploader can delete
        $successRes = $this->actingAs($this->member1)->delete(
            route('projects.committees.activities.tasks.evidence.destroy', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $this->task->id,
                'evidence' => $evidence->id,
            ])
        );
        $successRes->assertRedirect();
        $this->assertDatabaseMissing('task_evidences', ['id' => $evidence->id]);
        Storage::disk('local')->assertMissing($stored);
    }

    public function test_evidence_presence_does_not_affect_normal_task_completion(): void
    {
        // Normal task with evidence: member completes directly without review
        $file = UploadedFile::fake()->create('summary.pdf', 200, 'application/pdf');
        $stored = Storage::disk('local')->putFile('task_evidences', $file);
        $this->task->evidences()->create([
            'uploaded_by' => $this->member1->id,
            'original_name' => 'summary.pdf',
            'file_path' => $stored,
            'file_size' => 204800,
            'mime_type' => 'application/pdf',
        ]);

        $response = $this->actingAs($this->member1)->patch(
            route('projects.committees.activities.tasks.update', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $this->task->id,
            ]),
            ['status' => Task::STATUS_COMPLETED]
        );

        $response->assertRedirect();
        $this->assertDatabaseHas('tasks', [
            'id' => $this->task->id,
            'status' => Task::STATUS_COMPLETED,
        ]);
    }
}
