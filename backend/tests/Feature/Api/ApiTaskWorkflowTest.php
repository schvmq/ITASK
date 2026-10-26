<?php

namespace Tests\Feature\Api;

use App\Models\Activity;
use App\Models\ChecklistItem;
use App\Models\Committee;
use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Models\Task;
use App\Models\TaskEvidence;
use App\Models\User;
use App\Services\Authorization\RoleRegistry;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ApiTaskWorkflowTest extends TestCase
{
    use RefreshDatabase;

    public function test_leader_can_create_committee_and_assign_staff(): void
    {
        $leader = User::factory()->create();
        $staff = User::factory()->create();
        $project = Project::create([
            'title' => 'Committee Workflow Project',
            'created_by' => $leader->id,
            'status' => Project::STATUS_ACTIVE,
        ]);
        ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'user_id' => $leader->id,
            'role' => RoleRegistry::ROLE_PROJECT_LEADER,
        ]);
        ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'user_id' => $staff->id,
            'role' => RoleRegistry::ROLE_PROJECT_STAFF,
        ]);

        $response = $this->actingAs($leader)->postJson("/api/projects/{$project->id}/committees", [
            'name' => 'Logistics Committee',
            'description' => 'Handles logistics and venues',
            'user_id' => $staff->id,
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('committee.name', 'Logistics Committee');

        $this->assertDatabaseHas('committees', [
            'project_id' => $project->id,
            'name' => 'Logistics Committee',
        ]);
    }

    public function test_activity_and_task_lifecycle_via_api(): void
    {
        Storage::fake('local');

        $leader = User::factory()->create();
        $staff = User::factory()->create();
        $member = User::factory()->create();

        $project = Project::create([
            'title' => 'Deliverables Project',
            'created_by' => $leader->id,
            'status' => Project::STATUS_ACTIVE,
        ]);

        ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'user_id' => $leader->id,
            'role' => RoleRegistry::ROLE_PROJECT_LEADER,
        ]);

        $committee = $project->committees()->create([
            'name' => 'Documentation Committee',
        ]);

        ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'user_id' => $staff->id,
            'committee_id' => $committee->id,
            'role' => RoleRegistry::ROLE_PROJECT_STAFF,
        ]);

        ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'user_id' => $member->id,
            'committee_id' => $committee->id,
            'role' => RoleRegistry::ROLE_PROJECT_MEMBER,
        ]);

        // 1. Staff creates activity
        $actRes = $this->actingAs($staff)->postJson("/api/projects/{$project->id}/committees/{$committee->id}/activities", [
            'title' => 'Final Report Draft',
            'description' => 'Draft the comprehensive report',
            'start_date' => '2026-10-01',
            'end_date' => '2026-10-20',
        ]);
        $actRes->assertStatus(201);
        $activityId = $actRes->json('activity.id');

        // 2. Staff creates task with requires_review
        $taskRes = $this->actingAs($staff)->postJson("/api/projects/{$project->id}/committees/{$committee->id}/activities/{$activityId}/tasks", [
            'title' => 'Compile Section A',
            'description' => 'Introduction and methodology',
            'due_date' => '2026-10-15',
            'assigned_to' => $member->id,
            'requires_review' => true,
        ]);
        $taskRes->assertStatus(201);
        $taskId = $taskRes->json('task.id');

        // 3. Member adds checklist item
        $chkRes = $this->actingAs($member)->postJson("/api/projects/{$project->id}/committees/{$committee->id}/activities/{$activityId}/tasks/{$taskId}/checklist", [
            'content' => 'Proofread references',
        ]);
        $chkRes->assertStatus(201)
            ->assertJsonPath('item.content', 'Proofread references');
        $checkitemId = $chkRes->json('item.id');

        // 4. Member checks checklist item
        $chkUpd = $this->actingAs($member)->putJson("/api/projects/{$project->id}/committees/{$committee->id}/activities/{$activityId}/tasks/{$taskId}/checklist/{$checkitemId}", [
            'content' => 'Proofread references',
            'is_completed' => true,
        ]);
        $chkUpd->assertStatus(200)
            ->assertJsonPath('item.is_completed', true);

        // 5. Member uploads evidence file
        $evidenceFile = UploadedFile::fake()->create('proof.pdf', 300, 'application/pdf');
        $eviRes = $this->actingAs($member)->postJson("/api/projects/{$project->id}/committees/{$committee->id}/activities/{$activityId}/tasks/{$taskId}/evidence", [
            'file' => $evidenceFile,
            'notes' => 'Draft submitted',
        ]);
        $eviRes->assertStatus(201);

        // 6. Member submits task for review
        $subRes = $this->actingAs($member)->postJson("/api/projects/{$project->id}/committees/{$committee->id}/activities/{$activityId}/tasks/{$taskId}/submit");
        $subRes->assertStatus(200)
            ->assertJsonPath('status', Task::STATUS_UNDER_REVIEW);

        // 7. Member cannot directly complete review-required task
        $task = Task::find($taskId);
        $this->assertEquals(Task::STATUS_UNDER_REVIEW, $task->status);

        // 8. Staff reviews and approves
        $appRes = $this->actingAs($staff)->postJson("/api/projects/{$project->id}/committees/{$committee->id}/activities/{$activityId}/tasks/{$taskId}/approve");
        $appRes->assertStatus(200)
            ->assertJsonPath('status', Task::STATUS_COMPLETED);

        $this->assertEquals(Task::STATUS_COMPLETED, $task->fresh()->status);
    }

    public function test_task_return_and_resubmit_workflow(): void
    {
        $leader = User::factory()->create();
        $staff = User::factory()->create();
        $member = User::factory()->create();

        $project = Project::create([
            'title' => 'Revision Project',
            'created_by' => $leader->id,
            'status' => Project::STATUS_ACTIVE,
        ]);
        ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'user_id' => $leader->id,
            'role' => RoleRegistry::ROLE_PROJECT_LEADER,
        ]);

        $committee = $project->committees()->create(['name' => 'Review Committee']);
        ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'user_id' => $staff->id,
            'committee_id' => $committee->id,
            'role' => RoleRegistry::ROLE_PROJECT_STAFF,
        ]);
        ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'user_id' => $member->id,
            'committee_id' => $committee->id,
            'role' => RoleRegistry::ROLE_PROJECT_MEMBER,
        ]);

        $activity = $committee->activities()->create([
            'project_id' => $project->id,
            'created_by' => $staff->id,
            'title' => 'Review Activity',
            'status' => Activity::STATUS_IN_PROGRESS,
            'start_date' => '2026-10-01',
            'end_date' => '2026-10-20',
        ]);

        $task = $activity->tasks()->create([
            'title' => 'Needs Polish',
            'status' => Task::STATUS_UNDER_REVIEW,
            'assigned_to' => $member->id,
            'requires_review' => true,
        ]);

        // Staff returns task
        $retRes = $this->actingAs($staff)->postJson("/api/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}/tasks/{$task->id}/return", [
            'reviewer_notes' => 'Please fix section 2 format.',
        ]);
        $retRes->assertStatus(200)
            ->assertJsonPath('status', Task::STATUS_RETURNED);

        $this->assertEquals(Task::STATUS_RETURNED, $task->fresh()->status);

        // Member resubmits task
        $resubRes = $this->actingAs($member)->postJson("/api/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}/tasks/{$task->id}/resubmit");
        $resubRes->assertStatus(200)
            ->assertJsonPath('status', Task::STATUS_IN_PROGRESS);

        $this->assertEquals(Task::STATUS_IN_PROGRESS, $task->fresh()->status);
    }

    public function test_evidence_download_and_deletion(): void
    {
        Storage::fake('local');

        $staff = User::factory()->create();
        $member = User::factory()->create();

        $project = Project::create([
            'title' => 'Evidence Project',
            'created_by' => $staff->id,
            'status' => Project::STATUS_ACTIVE,
        ]);
        $committee = $project->committees()->create(['name' => 'Evidence Committee']);
        ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'user_id' => $staff->id,
            'committee_id' => $committee->id,
            'role' => RoleRegistry::ROLE_PROJECT_STAFF,
        ]);
        ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'user_id' => $member->id,
            'committee_id' => $committee->id,
            'role' => RoleRegistry::ROLE_PROJECT_MEMBER,
        ]);

        $activity = $committee->activities()->create([
            'project_id' => $project->id,
            'created_by' => $staff->id,
            'title' => 'Evidence Activity',
            'status' => Activity::STATUS_IN_PROGRESS,
            'start_date' => '2026-10-01',
            'end_date' => '2026-10-20',
        ]);
        $task = $activity->tasks()->create([
            'title' => 'Evidence Task',
            'status' => Task::STATUS_IN_PROGRESS,
            'assigned_to' => $member->id,
        ]);

        $file = UploadedFile::fake()->create('document.pdf', 100, 'application/pdf');
        $uploadRes = $this->actingAs($member)->postJson("/api/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}/tasks/{$task->id}/evidence", [
            'file' => $file,
            'remarks' => 'Here is my document',
        ]);
        $uploadRes->assertStatus(201);
        $evidenceId = $uploadRes->json('evidence.id');

        // Download
        $dlRes = $this->actingAs($member)->get("/api/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}/tasks/{$task->id}/evidence/{$evidenceId}/download");
        $dlRes->assertStatus(200);

        // Delete
        $delRes = $this->actingAs($member)->deleteJson("/api/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}/tasks/{$task->id}/evidence/{$evidenceId}");
        $delRes->assertStatus(200);

        $this->assertDatabaseMissing('task_evidences', ['id' => $evidenceId]);
    }

    public function test_checklist_item_deletion(): void
    {
        $staff = User::factory()->create();
        $member = User::factory()->create();

        $project = Project::create([
            'title' => 'Checklist Project',
            'created_by' => $staff->id,
            'status' => Project::STATUS_ACTIVE,
        ]);
        $committee = $project->committees()->create(['name' => 'Checklist Committee']);
        ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'user_id' => $staff->id,
            'committee_id' => $committee->id,
            'role' => RoleRegistry::ROLE_PROJECT_STAFF,
        ]);
        ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'user_id' => $member->id,
            'committee_id' => $committee->id,
            'role' => RoleRegistry::ROLE_PROJECT_MEMBER,
        ]);

        $activity = $committee->activities()->create([
            'project_id' => $project->id,
            'created_by' => $staff->id,
            'title' => 'Checklist Activity',
            'status' => Activity::STATUS_IN_PROGRESS,
            'start_date' => '2026-10-01',
            'end_date' => '2026-10-20',
        ]);
        $task = $activity->tasks()->create([
            'title' => 'Checklist Task',
            'status' => Task::STATUS_IN_PROGRESS,
            'assigned_to' => $member->id,
        ]);

        $addRes = $this->actingAs($member)->postJson("/api/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}/tasks/{$task->id}/checklist", [
            'content' => 'Item to delete',
        ]);
        $addRes->assertStatus(201);
        $checkitemId = $addRes->json('item.id');

        $delRes = $this->actingAs($member)->deleteJson("/api/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}/tasks/{$task->id}/checklist/{$checkitemId}");
        $delRes->assertStatus(200);

        $this->assertDatabaseMissing('checklist_items', ['id' => $checkitemId]);
    }

    public function test_activity_submit_and_staff_review(): void
    {
        $staff = User::factory()->create();
        $member = User::factory()->create();

        $project = Project::create([
            'title' => 'Activity Review Project',
            'created_by' => $staff->id,
            'status' => Project::STATUS_ACTIVE,
        ]);

        $committee = $project->committees()->create(['name' => 'Activity Review Committee']);
        ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'user_id' => $staff->id,
            'committee_id' => $committee->id,
            'role' => RoleRegistry::ROLE_PROJECT_STAFF,
        ]);
        ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'user_id' => $member->id,
            'committee_id' => $committee->id,
            'role' => RoleRegistry::ROLE_PROJECT_MEMBER,
        ]);

        $activity = $committee->activities()->create([
            'project_id' => $project->id,
            'created_by' => $staff->id,
            'title' => 'Reviewable Activity',
            'status' => Activity::STATUS_IN_PROGRESS,
            'start_date' => '2026-10-01',
            'end_date' => '2026-10-20',
        ]);

        // Member has task under this activity
        $task = $activity->tasks()->create([
            'title' => 'Member Task',
            'status' => Task::STATUS_IN_PROGRESS,
            'assigned_to' => $member->id,
        ]);

        // Member submits activity
        $subRes = $this->actingAs($member)->postJson("/api/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}/submit", [
            'submission_notes' => 'All tasks ready for review.',
        ]);
        $subRes->assertStatus(200)
            ->assertJsonPath('status', Activity::STATUS_UNDER_REVIEW);

        $this->assertEquals(Activity::STATUS_UNDER_REVIEW, $activity->fresh()->status);

        // Staff reviews and completes activity
        $revRes = $this->actingAs($staff)->postJson("/api/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}/review", [
            'action' => 'complete',
        ]);
        $revRes->assertStatus(200)
            ->assertJsonPath('status', Activity::STATUS_COMPLETED);

        $this->assertEquals(Activity::STATUS_COMPLETED, $activity->fresh()->status);
    }

    public function test_committee_member_assignment_and_removal(): void
    {
        $leader = User::factory()->create(['email_verified_at' => now()]);
        $staff = User::factory()->create(['email_verified_at' => now()]);
        $member = User::factory()->create(['email_verified_at' => now()]);

        $project = Project::create([
            'title' => 'Committee Member Project',
            'created_by' => $leader->id,
            'status' => Project::STATUS_ACTIVE,
        ]);
        ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'user_id' => $leader->id,
            'role' => RoleRegistry::ROLE_PROJECT_LEADER,
        ]);

        $committee = $project->committees()->create(['name' => 'Staff Committee']);
        ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'user_id' => $staff->id,
            'committee_id' => $committee->id,
            'role' => RoleRegistry::ROLE_PROJECT_STAFF,
        ]);

        // Member is assigned as Project Member on the project first
        ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'user_id' => $member->id,
            'role' => RoleRegistry::ROLE_PROJECT_MEMBER,
        ]);

        // Leader adds member to committee
        $addRes = $this->actingAs($leader)->postJson("/api/projects/{$project->id}/committees/{$committee->id}/members", [
            'user_id' => $member->id,
        ]);
        $addRes->assertStatus(200);

        $this->assertDatabaseHas('project_role_assignments', [
            'project_id' => $project->id,
            'committee_id' => $committee->id,
            'user_id' => $member->id,
            'role' => RoleRegistry::ROLE_PROJECT_MEMBER,
        ]);

        // Leader removes member from committee
        $remRes = $this->actingAs($leader)->deleteJson("/api/projects/{$project->id}/committees/{$committee->id}/members/{$member->id}");
        $remRes->assertStatus(200);

        $this->assertDatabaseMissing('project_role_assignments', [
            'project_id' => $project->id,
            'committee_id' => $committee->id,
            'user_id' => $member->id,
        ]);
    }
}
