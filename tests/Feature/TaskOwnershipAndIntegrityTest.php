<?php

namespace Tests\Feature;

use App\Models\Activity;
use App\Models\ChecklistItem;
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

class TaskOwnershipAndIntegrityTest extends TestCase
{
    use RefreshDatabase;

    protected User $leader;
    protected User $staff;
    protected User $otherStaff;
    protected User $member1;
    protected User $member2;
    protected Project $project;
    protected Committee $committee;
    protected Committee $otherCommittee;
    protected Activity $activity;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');

        $this->leader = $this->createVerifiedUser();
        $this->staff = $this->createVerifiedUser();
        $this->otherStaff = $this->createVerifiedUser();
        $this->member1 = $this->createVerifiedUser();
        $this->member2 = $this->createVerifiedUser();

        $this->project = Project::create([
            'title' => 'Integrity Project',
            'description' => 'Test project.',
            'status' => Project::STATUS_PLANNING,
            'created_by' => $this->leader->id,
        ]);

        ProjectRoleAssignment::create([
            'project_id' => $this->project->id,
            'user_id' => $this->leader->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_LEADER,
            'committee_id' => null,
        ]);

        $this->committee = Committee::create([
            'project_id' => $this->project->id,
            'name' => 'Main Committee',
        ]);

        $this->otherCommittee = Committee::create([
            'project_id' => $this->project->id,
            'name' => 'Other Committee',
        ]);

        ProjectRoleAssignment::create([
            'project_id' => $this->project->id,
            'user_id' => $this->staff->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_STAFF,
            'committee_id' => $this->committee->id,
        ]);

        ProjectRoleAssignment::create([
            'project_id' => $this->project->id,
            'user_id' => $this->otherStaff->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_STAFF,
            'committee_id' => $this->otherCommittee->id,
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
            'title' => 'Main Activity',
            'status' => Activity::STATUS_IN_PROGRESS,
        ]);
    }

    protected function createVerifiedUser(): User
    {
        $user = User::create([
            'name' => 'User ' . uniqid(),
            'email' => 'user_' . uniqid() . '@carsu.edu.ph',
            'password' => 'SecurePass123!',
        ]);
        $user->forceFill(['email_verified_at' => now()])->save();
        return $user;
    }

    protected function createTask(array $overrides = []): Task
    {
        return Task::create(array_merge([
            'activity_id' => $this->activity->id,
            'title' => 'Sample Task',
            'status' => Task::STATUS_TO_DO,
            'assigned_to' => $this->member1->id,
            'requires_review' => false,
        ], $overrides));
    }

    // =========================================================================
    // TASK STATUS (1-12)
    // =========================================================================

    /** 1. Assigned personnel can change their own task status. */
    public function test_1_assigned_personnel_can_change_own_task_status(): void
    {
        $task = $this->createTask(['assigned_to' => $this->member1->id, 'status' => Task::STATUS_TO_DO]);

        $this->actingAs($this->member1)
            ->patch(route('projects.committees.activities.tasks.update', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $task->id,
            ]), ['status' => Task::STATUS_IN_PROGRESS])
            ->assertRedirect();

        $this->assertDatabaseHas('tasks', ['id' => $task->id, 'status' => Task::STATUS_IN_PROGRESS]);
    }

    /** 2. Another Project Member cannot change the assigned person's status. */
    public function test_2_another_member_cannot_change_assigned_person_status(): void
    {
        $task = $this->createTask(['assigned_to' => $this->member1->id, 'status' => Task::STATUS_TO_DO]);

        $this->actingAs($this->member2)
            ->patch(route('projects.committees.activities.tasks.update', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $task->id,
            ]), ['status' => Task::STATUS_IN_PROGRESS])
            ->assertForbidden();

        $this->assertDatabaseHas('tasks', ['id' => $task->id, 'status' => Task::STATUS_TO_DO]);
    }

    /** 3. Project Staff cannot directly change the assigned person's status. */
    public function test_3_project_staff_cannot_directly_change_assigned_person_status(): void
    {
        $task = $this->createTask(['assigned_to' => $this->member1->id, 'status' => Task::STATUS_TO_DO]);

        $this->actingAs($this->staff)
            ->patch(route('projects.committees.activities.tasks.update', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $task->id,
            ]), ['status' => Task::STATUS_IN_PROGRESS])
            ->assertForbidden();

        $this->assertDatabaseHas('tasks', ['id' => $task->id, 'status' => Task::STATUS_TO_DO]);
    }

    /** 4. Project Leader cannot directly change the assigned person's status. */
    public function test_4_project_leader_cannot_directly_change_assigned_person_status(): void
    {
        $task = $this->createTask(['assigned_to' => $this->member1->id, 'status' => Task::STATUS_TO_DO]);

        $this->actingAs($this->leader)
            ->patch(route('projects.committees.activities.tasks.update', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $task->id,
            ]), ['status' => Task::STATUS_IN_PROGRESS])
            ->assertForbidden();

        $this->assertDatabaseHas('tasks', ['id' => $task->id, 'status' => Task::STATUS_TO_DO]);
    }

    /** 5. Assigned personnel can follow the normal no-review workflow. */
    public function test_5_assigned_personnel_can_follow_normal_no_review_workflow(): void
    {
        $task = $this->createTask(['assigned_to' => $this->member1->id, 'status' => Task::STATUS_TO_DO, 'requires_review' => false]);

        // To Do -> In Progress
        $this->actingAs($this->member1)
            ->patch(route('projects.committees.activities.tasks.update', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $task->id,
            ]), ['status' => Task::STATUS_IN_PROGRESS])
            ->assertRedirect();
        $this->assertDatabaseHas('tasks', ['id' => $task->id, 'status' => Task::STATUS_IN_PROGRESS]);

        // In Progress -> Completed
        $this->actingAs($this->member1)
            ->patch(route('projects.committees.activities.tasks.update', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $task->id,
            ]), ['status' => Task::STATUS_COMPLETED])
            ->assertRedirect();
        $this->assertDatabaseHas('tasks', ['id' => $task->id, 'status' => Task::STATUS_COMPLETED]);
    }

    /** 6. Assigned personnel cannot directly mark a review-required task Completed. */
    public function test_6_assigned_personnel_cannot_directly_mark_review_required_task_completed(): void
    {
        $task = $this->createTask(['assigned_to' => $this->member1->id, 'status' => Task::STATUS_IN_PROGRESS, 'requires_review' => true]);

        $this->actingAs($this->member1)
            ->patch(route('projects.committees.activities.tasks.update', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $task->id,
            ]), ['status' => Task::STATUS_COMPLETED])
            ->assertSessionHasErrors('status');

        $this->assertDatabaseHas('tasks', ['id' => $task->id, 'status' => Task::STATUS_IN_PROGRESS]);
    }

    /** 7. Assigned personnel can submit a review-required task. */
    public function test_7_assigned_personnel_can_submit_review_required_task(): void
    {
        $task = $this->createTask(['assigned_to' => $this->member1->id, 'status' => Task::STATUS_IN_PROGRESS, 'requires_review' => true]);

        $this->actingAs($this->member1)
            ->post(route('projects.committees.activities.tasks.submit', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $task->id,
            ]))
            ->assertRedirect();

        $this->assertDatabaseHas('tasks', ['id' => $task->id, 'status' => Task::STATUS_UNDER_REVIEW]);
    }

    /** 8. Committee Staff can approve a submitted task. */
    public function test_8_committee_staff_can_approve_submitted_task(): void
    {
        $task = $this->createTask(['assigned_to' => $this->member1->id, 'status' => Task::STATUS_UNDER_REVIEW, 'requires_review' => true]);

        $this->actingAs($this->staff)
            ->post(route('projects.committees.activities.tasks.approve', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $task->id,
            ]), ['remarks' => 'Approved cleanly'])
            ->assertRedirect();

        $this->assertDatabaseHas('tasks', ['id' => $task->id, 'status' => Task::STATUS_COMPLETED]);
    }

    /** 9. Committee Staff can return a submitted task. */
    public function test_9_committee_staff_can_return_submitted_task(): void
    {
        $task = $this->createTask(['assigned_to' => $this->member1->id, 'status' => Task::STATUS_UNDER_REVIEW, 'requires_review' => true]);

        $this->actingAs($this->staff)
            ->post(route('projects.committees.activities.tasks.return', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $task->id,
            ]), ['remarks' => 'Please provide more details'])
            ->assertRedirect();

        $this->assertDatabaseHas('tasks', ['id' => $task->id, 'status' => Task::STATUS_RETURNED]);
    }

    /** 10. Assigned personnel can resubmit a Returned task. */
    public function test_10_assigned_personnel_can_resubmit_returned_task(): void
    {
        $task = $this->createTask(['assigned_to' => $this->member1->id, 'status' => Task::STATUS_RETURNED, 'requires_review' => true]);

        // Resubmit returned task -> returns task to In Progress for revision
        $this->actingAs($this->member1)
            ->post(route('projects.committees.activities.tasks.resubmit', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $task->id,
            ]), ['submission_notes' => 'Resuming work on revisions'])
            ->assertRedirect();

        $this->assertDatabaseHas('tasks', ['id' => $task->id, 'status' => Task::STATUS_IN_PROGRESS]);

        // Member can then submit again once revised
        $this->actingAs($this->member1)
            ->post(route('projects.committees.activities.tasks.submit', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $task->id,
            ]), ['submission_notes' => 'Revised and resubmitted'])
            ->assertRedirect();

        $this->assertDatabaseHas('tasks', ['id' => $task->id, 'status' => Task::STATUS_UNDER_REVIEW]);
    }

    /** 11. Project Leader who is not Committee Staff cannot approve/return a task. */
    public function test_11_project_leader_who_is_not_committee_staff_cannot_approve_or_return(): void
    {
        $task = $this->createTask(['assigned_to' => $this->member1->id, 'status' => Task::STATUS_UNDER_REVIEW, 'requires_review' => true]);

        $this->actingAs($this->leader)
            ->post(route('projects.committees.activities.tasks.approve', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $task->id,
            ]))
            ->assertForbidden();

        $this->actingAs($this->leader)
            ->post(route('projects.committees.activities.tasks.return', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $task->id,
            ]), ['remarks' => 'Leader returning'])
            ->assertForbidden();

        $this->assertDatabaseHas('tasks', ['id' => $task->id, 'status' => Task::STATUS_UNDER_REVIEW]);
    }

    /** 12. Project Staff who is not assigned to the committee cannot approve/return a task. */
    public function test_12_other_committee_staff_cannot_approve_or_return(): void
    {
        $task = $this->createTask(['assigned_to' => $this->member1->id, 'status' => Task::STATUS_UNDER_REVIEW, 'requires_review' => true]);

        $this->actingAs($this->otherStaff)
            ->post(route('projects.committees.activities.tasks.approve', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $task->id,
            ]))
            ->assertForbidden();

        $this->actingAs($this->otherStaff)
            ->post(route('projects.committees.activities.tasks.return', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $task->id,
            ]), ['remarks' => 'Other staff returning'])
            ->assertForbidden();

        $this->assertDatabaseHas('tasks', ['id' => $task->id, 'status' => Task::STATUS_UNDER_REVIEW]);
    }

    // =========================================================================
    // CHECKLIST (13-18)
    // =========================================================================

    /** 13. Assigned personnel can create checklist items. */
    public function test_13_assigned_personnel_can_create_checklist_items(): void
    {
        $task = $this->createTask(['assigned_to' => $this->member1->id]);

        $this->actingAs($this->member1)
            ->post(route('projects.committees.activities.tasks.checklist.store', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $task->id,
            ]), ['content' => 'Item by assignee'])
            ->assertSessionDoesntHaveErrors();

        $this->assertDatabaseHas('checklist_items', ['task_id' => $task->id, 'content' => 'Item by assignee']);
    }

    /** 14. Assigned personnel can update checklist items. */
    public function test_14_assigned_personnel_can_update_checklist_items(): void
    {
        $task = $this->createTask(['assigned_to' => $this->member1->id]);
        $item = ChecklistItem::create(['task_id' => $task->id, 'content' => 'Old', 'is_completed' => false]);

        $this->actingAs($this->member1)
            ->patch(route('projects.committees.activities.tasks.checklist.update', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $task->id,
                'checklist_item' => $item->id,
            ]), ['content' => 'Updated by assignee', 'is_completed' => true])
            ->assertRedirect();

        $this->assertDatabaseHas('checklist_items', ['id' => $item->id, 'content' => 'Updated by assignee', 'is_completed' => true]);
    }

    /** 15. Assigned personnel can delete checklist items. */
    public function test_15_assigned_personnel_can_delete_checklist_items(): void
    {
        $task = $this->createTask(['assigned_to' => $this->member1->id]);
        $item = ChecklistItem::create(['task_id' => $task->id, 'content' => 'To delete', 'is_completed' => false]);

        $this->actingAs($this->member1)
            ->delete(route('projects.committees.activities.tasks.checklist.destroy', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $task->id,
                'checklist_item' => $item->id,
            ]))
            ->assertRedirect();

        $this->assertDatabaseMissing('checklist_items', ['id' => $item->id]);
    }

    /** 16. Another Project Member cannot modify the checklist. */
    public function test_16_another_project_member_cannot_modify_checklist(): void
    {
        $task = $this->createTask(['assigned_to' => $this->member1->id]);
        $item = ChecklistItem::create(['task_id' => $task->id, 'content' => 'Existing', 'is_completed' => false]);

        // Create attempt
        $this->actingAs($this->member2)
            ->post(route('projects.committees.activities.tasks.checklist.store', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $task->id,
            ]), ['content' => 'Malicious item'])
            ->assertForbidden();

        // Update attempt
        $this->actingAs($this->member2)
            ->patch(route('projects.committees.activities.tasks.checklist.update', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $task->id,
                'checklist_item' => $item->id,
            ]), ['is_completed' => true])
            ->assertForbidden();

        // Delete attempt
        $this->actingAs($this->member2)
            ->delete(route('projects.committees.activities.tasks.checklist.destroy', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $task->id,
                'checklist_item' => $item->id,
            ]))
            ->assertForbidden();

        $this->assertDatabaseMissing('checklist_items', ['content' => 'Malicious item']);
        $this->assertDatabaseHas('checklist_items', ['id' => $item->id, 'is_completed' => false]);
    }

    /** 17. Project Staff cannot modify the assigned person's checklist. */
    public function test_17_project_staff_cannot_modify_assigned_person_checklist(): void
    {
        $task = $this->createTask(['assigned_to' => $this->member1->id]);
        $item = ChecklistItem::create(['task_id' => $task->id, 'content' => 'Existing', 'is_completed' => false]);

        $this->actingAs($this->staff)
            ->post(route('projects.committees.activities.tasks.checklist.store', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $task->id,
            ]), ['content' => 'Staff item'])
            ->assertForbidden();

        $this->actingAs($this->staff)
            ->patch(route('projects.committees.activities.tasks.checklist.update', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $task->id,
                'checklist_item' => $item->id,
            ]), ['is_completed' => true])
            ->assertForbidden();

        $this->actingAs($this->staff)
            ->delete(route('projects.committees.activities.tasks.checklist.destroy', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $task->id,
                'checklist_item' => $item->id,
            ]))
            ->assertForbidden();

        $this->assertDatabaseMissing('checklist_items', ['content' => 'Staff item']);
        $this->assertDatabaseHas('checklist_items', ['id' => $item->id, 'is_completed' => false]);
    }

    /** 18. Project Leader cannot modify the assigned person's checklist. */
    public function test_18_project_leader_cannot_modify_assigned_person_checklist(): void
    {
        $task = $this->createTask(['assigned_to' => $this->member1->id]);
        $item = ChecklistItem::create(['task_id' => $task->id, 'content' => 'Existing', 'is_completed' => false]);

        $this->actingAs($this->leader)
            ->post(route('projects.committees.activities.tasks.checklist.store', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $task->id,
            ]), ['content' => 'Leader item'])
            ->assertForbidden();

        $this->actingAs($this->leader)
            ->patch(route('projects.committees.activities.tasks.checklist.update', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $task->id,
                'checklist_item' => $item->id,
            ]), ['is_completed' => true])
            ->assertForbidden();

        $this->actingAs($this->leader)
            ->delete(route('projects.committees.activities.tasks.checklist.destroy', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $task->id,
                'checklist_item' => $item->id,
            ]))
            ->assertForbidden();

        $this->assertDatabaseMissing('checklist_items', ['content' => 'Leader item']);
        $this->assertDatabaseHas('checklist_items', ['id' => $item->id, 'is_completed' => false]);
    }

    // =========================================================================
    // EVIDENCE (19-30)
    // =========================================================================

    /** 19. Assigned personnel can upload evidence while To Do. */
    public function test_19_assigned_personnel_can_upload_evidence_while_to_do(): void
    {
        $task = $this->createTask(['assigned_to' => $this->member1->id, 'status' => Task::STATUS_TO_DO]);
        $file = UploadedFile::fake()->create('doc_todo.pdf', 100, 'application/pdf');

        $this->actingAs($this->member1)
            ->post(route('projects.committees.activities.tasks.evidence.store', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $task->id,
            ]), ['file' => $file, 'remarks' => 'Evidence in To Do'])
            ->assertRedirect();

        $this->assertDatabaseHas('task_evidences', ['task_id' => $task->id, 'remarks' => 'Evidence in To Do']);
    }

    /** 20. Assigned personnel can upload evidence while In Progress. */
    public function test_20_assigned_personnel_can_upload_evidence_while_in_progress(): void
    {
        $task = $this->createTask(['assigned_to' => $this->member1->id, 'status' => Task::STATUS_IN_PROGRESS]);
        $file = UploadedFile::fake()->create('doc_in_prog.pdf', 100, 'application/pdf');

        $this->actingAs($this->member1)
            ->post(route('projects.committees.activities.tasks.evidence.store', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $task->id,
            ]), ['file' => $file, 'remarks' => 'Evidence in In Progress'])
            ->assertRedirect();

        $this->assertDatabaseHas('task_evidences', ['task_id' => $task->id, 'remarks' => 'Evidence in In Progress']);
    }

    /** 21. Assigned personnel can upload evidence while Returned. */
    public function test_21_assigned_personnel_can_upload_evidence_while_returned(): void
    {
        $task = $this->createTask(['assigned_to' => $this->member1->id, 'status' => Task::STATUS_RETURNED]);
        $file = UploadedFile::fake()->create('doc_returned.pdf', 100, 'application/pdf');

        $this->actingAs($this->member1)
            ->post(route('projects.committees.activities.tasks.evidence.store', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $task->id,
            ]), ['file' => $file, 'remarks' => 'Evidence in Returned'])
            ->assertRedirect();

        $this->assertDatabaseHas('task_evidences', ['task_id' => $task->id, 'remarks' => 'Evidence in Returned']);
    }

    /** 22. Project Staff cannot upload evidence to another person's task. */
    public function test_22_project_staff_cannot_upload_evidence_to_another_person_task(): void
    {
        $task = $this->createTask(['assigned_to' => $this->member1->id, 'status' => Task::STATUS_IN_PROGRESS]);
        $file = UploadedFile::fake()->create('doc_staff.pdf', 100, 'application/pdf');

        $this->actingAs($this->staff)
            ->post(route('projects.committees.activities.tasks.evidence.store', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $task->id,
            ]), ['file' => $file])
            ->assertForbidden();

        $this->assertDatabaseMissing('task_evidences', ['task_id' => $task->id]);
    }

    /** 23. Project Leader cannot upload evidence to another person's task. */
    public function test_23_project_leader_cannot_upload_evidence_to_another_person_task(): void
    {
        $task = $this->createTask(['assigned_to' => $this->member1->id, 'status' => Task::STATUS_IN_PROGRESS]);
        $file = UploadedFile::fake()->create('doc_leader.pdf', 100, 'application/pdf');

        $this->actingAs($this->leader)
            ->post(route('projects.committees.activities.tasks.evidence.store', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $task->id,
            ]), ['file' => $file])
            ->assertForbidden();

        $this->assertDatabaseMissing('task_evidences', ['task_id' => $task->id]);
    }

    /** 24. Another Project Member cannot upload evidence to another person's task. */
    public function test_24_another_member_cannot_upload_evidence_to_another_person_task(): void
    {
        $task = $this->createTask(['assigned_to' => $this->member1->id, 'status' => Task::STATUS_IN_PROGRESS]);
        $file = UploadedFile::fake()->create('doc_other_member.pdf', 100, 'application/pdf');

        $this->actingAs($this->member2)
            ->post(route('projects.committees.activities.tasks.evidence.store', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $task->id,
            ]), ['file' => $file])
            ->assertForbidden();

        $this->assertDatabaseMissing('task_evidences', ['task_id' => $task->id]);
    }

    /** 25. Assigned personnel can delete their own evidence while the task is editable. */
    public function test_25_assigned_personnel_can_delete_own_evidence_in_editable_state(): void
    {
        $task = $this->createTask(['assigned_to' => $this->member1->id, 'status' => Task::STATUS_IN_PROGRESS]);
        $evidence = TaskEvidence::create([
            'task_id' => $task->id,
            'uploaded_by' => $this->member1->id,
            'file_path' => 'evidence/test.pdf',
            'original_name' => 'test.pdf',
            'file_size' => 1024,
            'mime_type' => 'application/pdf',
        ]);
        Storage::disk('local')->put('evidence/test.pdf', 'dummy');

        $this->actingAs($this->member1)
            ->delete(route('projects.committees.activities.tasks.evidence.destroy', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $task->id,
                'evidence' => $evidence->id,
            ]))
            ->assertRedirect();

        $this->assertDatabaseMissing('task_evidences', ['id' => $evidence->id]);
    }

    /** 26. Assigned personnel cannot delete evidence while Under Review. */
    public function test_26_assigned_personnel_cannot_delete_evidence_while_under_review(): void
    {
        $task = $this->createTask(['assigned_to' => $this->member1->id, 'status' => Task::STATUS_UNDER_REVIEW]);
        $evidence = TaskEvidence::create([
            'task_id' => $task->id,
            'uploaded_by' => $this->member1->id,
            'file_path' => 'evidence/test.pdf',
            'original_name' => 'test.pdf',
            'file_size' => 1024,
            'mime_type' => 'application/pdf',
        ]);

        $this->actingAs($this->member1)
            ->delete(route('projects.committees.activities.tasks.evidence.destroy', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $task->id,
                'evidence' => $evidence->id,
            ]))
            ->assertForbidden();

        $this->assertDatabaseHas('task_evidences', ['id' => $evidence->id]);
    }

    /** 27. Assigned personnel cannot delete evidence while Completed. */
    public function test_27_assigned_personnel_cannot_delete_evidence_while_completed(): void
    {
        $task = $this->createTask(['assigned_to' => $this->member1->id, 'status' => Task::STATUS_COMPLETED]);
        $evidence = TaskEvidence::create([
            'task_id' => $task->id,
            'uploaded_by' => $this->member1->id,
            'file_path' => 'evidence/test.pdf',
            'original_name' => 'test.pdf',
            'file_size' => 1024,
            'mime_type' => 'application/pdf',
        ]);

        $this->actingAs($this->member1)
            ->delete(route('projects.committees.activities.tasks.evidence.destroy', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $task->id,
                'evidence' => $evidence->id,
            ]))
            ->assertForbidden();

        $this->assertDatabaseHas('task_evidences', ['id' => $evidence->id]);
    }

    /** 28. Project Staff cannot delete another person's evidence. */
    public function test_28_project_staff_cannot_delete_another_person_evidence(): void
    {
        $task = $this->createTask(['assigned_to' => $this->member1->id, 'status' => Task::STATUS_IN_PROGRESS]);
        $evidence = TaskEvidence::create([
            'task_id' => $task->id,
            'uploaded_by' => $this->member1->id,
            'file_path' => 'evidence/test.pdf',
            'original_name' => 'test.pdf',
            'file_size' => 1024,
            'mime_type' => 'application/pdf',
        ]);

        $this->actingAs($this->staff)
            ->delete(route('projects.committees.activities.tasks.evidence.destroy', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $task->id,
                'evidence' => $evidence->id,
            ]))
            ->assertForbidden();

        $this->assertDatabaseHas('task_evidences', ['id' => $evidence->id]);
    }

    /** 29. Project Leader cannot delete another person's evidence. */
    public function test_29_project_leader_cannot_delete_another_person_evidence(): void
    {
        $task = $this->createTask(['assigned_to' => $this->member1->id, 'status' => Task::STATUS_IN_PROGRESS]);
        $evidence = TaskEvidence::create([
            'task_id' => $task->id,
            'uploaded_by' => $this->member1->id,
            'file_path' => 'evidence/test.pdf',
            'original_name' => 'test.pdf',
            'file_size' => 1024,
            'mime_type' => 'application/pdf',
        ]);

        $this->actingAs($this->leader)
            ->delete(route('projects.committees.activities.tasks.evidence.destroy', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $task->id,
                'evidence' => $evidence->id,
            ]))
            ->assertForbidden();

        $this->assertDatabaseHas('task_evidences', ['id' => $evidence->id]);
    }

    /** 30. Authorized users can still view/download evidence normally. */
    public function test_30_authorized_users_can_view_and_download_evidence(): void
    {
        $task = $this->createTask(['assigned_to' => $this->member1->id, 'status' => Task::STATUS_IN_PROGRESS]);
        $evidence = TaskEvidence::create([
            'task_id' => $task->id,
            'uploaded_by' => $this->member1->id,
            'file_path' => 'evidence/test_download.pdf',
            'original_name' => 'test_download.pdf',
            'file_size' => 1024,
            'mime_type' => 'application/pdf',
        ]);
        Storage::disk('local')->put('evidence/test_download.pdf', 'pdf content');

        // Leader download
        $this->actingAs($this->leader)
            ->get(route('projects.committees.activities.tasks.evidence.download', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $task->id,
                'evidence' => $evidence->id,
            ]))
            ->assertOk();

        // Staff download
        $this->actingAs($this->staff)
            ->get(route('projects.committees.activities.tasks.evidence.download', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $task->id,
                'evidence' => $evidence->id,
            ]))
            ->assertOk();

        // Assignee download
        $this->actingAs($this->member1)
            ->get(route('projects.committees.activities.tasks.evidence.download', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $task->id,
                'evidence' => $evidence->id,
            ]))
            ->assertOk();

        // Committee Member download
        $this->actingAs($this->member2)
            ->get(route('projects.committees.activities.tasks.evidence.download', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $task->id,
                'evidence' => $evidence->id,
            ]))
            ->assertOk();
    }

    // =========================================================================
    // TASK DELETION (31-36)
    // =========================================================================

    /** 31. Authorized manager can delete a To Do task with no evidence. */
    public function test_31_authorized_manager_can_delete_to_do_task_with_no_evidence(): void
    {
        $task = $this->createTask(['status' => Task::STATUS_TO_DO]);

        $this->actingAs($this->staff)
            ->delete(route('projects.committees.activities.tasks.destroy', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $task->id,
            ]))
            ->assertRedirect();

        $this->assertDatabaseMissing('tasks', ['id' => $task->id]);
    }

    /** 32. Started task cannot be deleted. */
    public function test_32_started_task_cannot_be_deleted(): void
    {
        $task = $this->createTask(['status' => Task::STATUS_IN_PROGRESS]);

        $this->actingAs($this->staff)
            ->delete(route('projects.committees.activities.tasks.destroy', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $task->id,
            ]))
            ->assertForbidden();

        $this->assertDatabaseHas('tasks', ['id' => $task->id]);
    }

    /** 33. Under Review task cannot be deleted. */
    public function test_33_under_review_task_cannot_be_deleted(): void
    {
        $task = $this->createTask(['status' => Task::STATUS_UNDER_REVIEW]);

        $this->actingAs($this->staff)
            ->delete(route('projects.committees.activities.tasks.destroy', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $task->id,
            ]))
            ->assertForbidden();

        $this->assertDatabaseHas('tasks', ['id' => $task->id]);
    }

    /** 34. Returned task cannot be deleted. */
    public function test_34_returned_task_cannot_be_deleted(): void
    {
        $task = $this->createTask(['status' => Task::STATUS_RETURNED]);

        $this->actingAs($this->staff)
            ->delete(route('projects.committees.activities.tasks.destroy', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $task->id,
            ]))
            ->assertForbidden();

        $this->assertDatabaseHas('tasks', ['id' => $task->id]);
    }

    /** 35. Completed task cannot be deleted. */
    public function test_35_completed_task_cannot_be_deleted(): void
    {
        $task = $this->createTask(['status' => Task::STATUS_COMPLETED]);

        $this->actingAs($this->staff)
            ->delete(route('projects.committees.activities.tasks.destroy', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $task->id,
            ]))
            ->assertForbidden();

        $this->assertDatabaseHas('tasks', ['id' => $task->id]);
    }

    /** 36. Task with evidence cannot be deleted even if its status is To Do. */
    public function test_36_task_with_evidence_cannot_be_deleted_even_if_to_do(): void
    {
        $task = $this->createTask(['status' => Task::STATUS_TO_DO]);
        TaskEvidence::create([
            'task_id' => $task->id,
            'uploaded_by' => $this->member1->id,
            'file_path' => 'evidence/test.pdf',
            'original_name' => 'test.pdf',
            'file_size' => 1024,
            'mime_type' => 'application/pdf',
        ]);

        $this->actingAs($this->staff)
            ->delete(route('projects.committees.activities.tasks.destroy', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $task->id,
            ]))
            ->assertForbidden();

        $this->assertDatabaseHas('tasks', ['id' => $task->id]);
    }

    // =========================================================================
    // TASK CREATION (37-40)
    // =========================================================================

    /** 37. New tasks always begin as To Do. */
    public function test_37_new_tasks_always_begin_as_to_do(): void
    {
        $response = $this->actingAs($this->staff)
            ->post(route('projects.committees.activities.tasks.store', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
            ]), ['title' => 'Fresh New Task']);

        $response->assertRedirect();
        $this->assertDatabaseHas('tasks', [
            'activity_id' => $this->activity->id,
            'title' => 'Fresh New Task',
            'status' => Task::STATUS_TO_DO,
        ]);
    }

    /** 38. Client input cannot create a task directly as Completed. */
    public function test_38_client_input_cannot_create_task_directly_as_completed(): void
    {
        $response = $this->actingAs($this->staff)
            ->post(route('projects.committees.activities.tasks.store', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
            ]), [
                'title' => 'Task Bypass Attempt',
                'status' => Task::STATUS_COMPLETED,
            ]);

        $response->assertSessionHasErrors('status');
        $this->assertDatabaseMissing('tasks', ['title' => 'Task Bypass Attempt']);
    }

    /** 39. Client input cannot create a task directly as Under Review. */
    public function test_39_client_input_cannot_create_task_directly_as_under_review(): void
    {
        $response = $this->actingAs($this->staff)
            ->post(route('projects.committees.activities.tasks.store', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
            ]), [
                'title' => 'Task Bypass Under Review',
                'status' => Task::STATUS_UNDER_REVIEW,
            ]);

        $response->assertSessionHasErrors('status');
        $this->assertDatabaseMissing('tasks', ['title' => 'Task Bypass Under Review']);
    }

    /** 40. Client input cannot create a task directly as Returned. */
    public function test_40_client_input_cannot_create_task_directly_as_returned(): void
    {
        $response = $this->actingAs($this->staff)
            ->post(route('projects.committees.activities.tasks.store', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
            ]), [
                'title' => 'Task Bypass Returned',
                'status' => Task::STATUS_RETURNED,
            ]);

        $response->assertSessionHasErrors('status');
        $this->assertDatabaseMissing('tasks', ['title' => 'Task Bypass Returned']);
    }

    // =========================================================================
    // EDGE CASES (A-C)
    // =========================================================================

    /** Edge Case A: Unassigned task cannot have status changed by anyone until assigned. */
    public function test_edge_case_a_unassigned_task_status_cannot_be_changed(): void
    {
        $task = $this->createTask(['assigned_to' => null, 'status' => Task::STATUS_TO_DO]);

        $this->actingAs($this->staff)
            ->patch(route('projects.committees.activities.tasks.update', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $task->id,
            ]), ['status' => Task::STATUS_IN_PROGRESS])
            ->assertForbidden();

        $this->actingAs($this->leader)
            ->patch(route('projects.committees.activities.tasks.update', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $task->id,
            ]), ['status' => Task::STATUS_IN_PROGRESS])
            ->assertForbidden();
    }

    /** Edge Case B: Project Leader assigned to task CAN execute task status and checklist. */
    public function test_edge_case_b_project_leader_assigned_to_task_can_execute(): void
    {
        $task = $this->createTask(['assigned_to' => $this->leader->id, 'status' => Task::STATUS_TO_DO]);

        // Leader changes status because they are the assigned personnel
        $this->actingAs($this->leader)
            ->patch(route('projects.committees.activities.tasks.update', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $task->id,
            ]), ['status' => Task::STATUS_IN_PROGRESS])
            ->assertRedirect();

        $this->assertDatabaseHas('tasks', ['id' => $task->id, 'status' => Task::STATUS_IN_PROGRESS]);

        // Leader adds checklist item because they are the assigned personnel
        $this->actingAs($this->leader)
            ->post(route('projects.committees.activities.tasks.checklist.store', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $task->id,
            ]), ['content' => 'Leader assignee checklist item'])
            ->assertSessionDoesntHaveErrors();

        $this->assertDatabaseHas('checklist_items', ['task_id' => $task->id, 'content' => 'Leader assignee checklist item']);
    }

    /** Edge Case C: Project Staff assigned to task CAN execute task status and checklist. */
    public function test_edge_case_c_project_staff_assigned_to_task_can_execute(): void
    {
        $task = $this->createTask(['assigned_to' => $this->staff->id, 'status' => Task::STATUS_TO_DO]);

        // Staff changes status because they are the assigned personnel
        $this->actingAs($this->staff)
            ->patch(route('projects.committees.activities.tasks.update', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $task->id,
            ]), ['status' => Task::STATUS_IN_PROGRESS])
            ->assertRedirect();

        $this->assertDatabaseHas('tasks', ['id' => $task->id, 'status' => Task::STATUS_IN_PROGRESS]);

        // Staff adds checklist item because they are the assigned personnel
        $this->actingAs($this->staff)
            ->post(route('projects.committees.activities.tasks.checklist.store', [
                'project' => $this->project->id,
                'committee' => $this->committee->id,
                'activity' => $this->activity->id,
                'task' => $task->id,
            ]), ['content' => 'Staff assignee checklist item'])
            ->assertSessionDoesntHaveErrors();

        $this->assertDatabaseHas('checklist_items', ['task_id' => $task->id, 'content' => 'Staff assignee checklist item']);
    }
}
