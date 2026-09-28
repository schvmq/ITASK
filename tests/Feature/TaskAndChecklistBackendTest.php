<?php

namespace Tests\Feature;

use App\Models\Activity;
use App\Models\ChecklistItem;
use App\Models\Committee;
use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Day 9 Step 2 — Task & Checklist Backend Foundation Tests
 *
 * Covers: Task persistence, relationships, assignment, deadlines, statuses,
 * Checklist creation/update/deletion, authorization, cross-project isolation.
 */
class TaskAndChecklistBackendTest extends TestCase
{
    use RefreshDatabase;

    // =========================================================================
    // HELPERS
    // =========================================================================

    protected function createVerifiedUser(array $attributes = []): User
    {
        $user = User::create(array_merge([
            'name'     => 'User ' . uniqid(),
            'email'    => 'user_' . uniqid() . '@carsu.edu.ph',
            'password' => 'SecurePass123!',
        ], $attributes));

        $user->forceFill(['email_verified_at' => now()])->save();

        return $user;
    }

    protected function createProjectWithLeader(User $leader, array $attributes = []): Project
    {
        $project = Project::create(array_merge([
            'title'       => 'Project ' . uniqid(),
            'description' => 'Test project.',
            'status'      => Project::STATUS_PLANNING,
            'created_by'  => $leader->id,
        ], $attributes));

        ProjectRoleAssignment::create([
            'project_id'   => $project->id,
            'user_id'      => $leader->id,
            'role'         => ProjectRoleAssignment::ROLE_PROJECT_LEADER,
            'committee_id' => null,
        ]);

        return $project;
    }

    protected function assignRole(Project $project, User $user, string $role, ?int $committeeId = null): void
    {
        ProjectRoleAssignment::create([
            'project_id'   => $project->id,
            'user_id'      => $user->id,
            'role'         => $role,
            'committee_id' => $committeeId,
        ]);
    }

    protected function createCommitteeWithStaff(Project $project, User $staff): Committee
    {
        $committee = Committee::create([
            'project_id'  => $project->id,
            'name'        => 'Committee ' . uniqid(),
            'description' => 'Test committee.',
        ]);

        $existing = ProjectRoleAssignment::where('project_id', $project->id)
            ->where('user_id', $staff->id)->first();

        if ($existing) {
            $existing->update(['role' => ProjectRoleAssignment::ROLE_PROJECT_STAFF, 'committee_id' => $committee->id]);
        } else {
            $this->assignRole($project, $staff, ProjectRoleAssignment::ROLE_PROJECT_STAFF, $committee->id);
        }

        return $committee;
    }

    protected function createActivity(Committee $committee, User $creator): Activity
    {
        return Activity::create([
            'project_id'   => $committee->project_id,
            'committee_id' => $committee->id,
            'created_by'   => $creator->id,
            'title'        => 'Activity ' . uniqid(),
            'status'       => Activity::STATUS_TO_DO,
        ]);
    }

    protected function createTask(Activity $activity, User $assignee = null, array $attributes = []): Task
    {
        return Task::create(array_merge([
            'activity_id' => $activity->id,
            'assigned_to' => $assignee?->id,
            'title'       => 'Task ' . uniqid(),
            'description' => 'Test task.',
            'status'      => Task::STATUS_TO_DO,
            'due_date'    => now()->addDays(7)->format('Y-m-d'),
        ], $attributes));
    }

    protected function createChecklistItem(Task $task, array $attributes = []): ChecklistItem
    {
        return ChecklistItem::create(array_merge([
            'task_id'      => $task->id,
            'content'      => 'Checklist item ' . uniqid(),
            'is_completed' => false,
            'order'        => 0,
        ], $attributes));
    }

    protected function taskRoute(Project $project, Committee $committee, Activity $activity): string
    {
        return "/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}/tasks";
    }

    protected function taskUpdateRoute(Project $project, Committee $committee, Activity $activity, Task $task): string
    {
        return "/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}/tasks/{$task->id}";
    }

    protected function checklistRoute(Project $project, Committee $committee, Activity $activity, Task $task): string
    {
        return "/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}/tasks/{$task->id}/checklist";
    }

    protected function checklistItemRoute(Project $project, Committee $committee, Activity $activity, Task $task, ChecklistItem $item): string
    {
        return "/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}/tasks/{$task->id}/checklist/{$item->id}";
    }

    // =========================================================================
    // SECTION 1 — TASK STATUS CONSTANTS
    // =========================================================================

    /** 1. Task STATUS_TO_DO constant value. */
    public function test_task_status_to_do_constant(): void
    {
        $this->assertSame('To Do', Task::STATUS_TO_DO);
        $this->assertSame('To Do', Task::STATUS_TODO);
    }

    /** 2. Task STATUS_IN_PROGRESS constant value. */
    public function test_task_status_in_progress_constant(): void
    {
        $this->assertSame('In Progress', Task::STATUS_IN_PROGRESS);
    }

    /** 3. Task STATUS_UNDER_REVIEW constant value. */
    public function test_task_status_under_review_constant(): void
    {
        $this->assertSame('Under Review', Task::STATUS_UNDER_REVIEW);
    }

    /** 4. Task STATUS_RETURNED constant value. */
    public function test_task_status_returned_constant(): void
    {
        $this->assertSame('Returned', Task::STATUS_RETURNED);
    }

    /** 5. Task STATUS_COMPLETED constant value. */
    public function test_task_status_completed_constant(): void
    {
        $this->assertSame('Completed', Task::STATUS_COMPLETED);
    }

    /** 6. STATUSES array contains exactly the five approved statuses. */
    public function test_task_statuses_array_contains_exactly_five_approved_statuses(): void
    {
        $this->assertCount(5, Task::STATUSES);
        $this->assertContains('To Do', Task::STATUSES);
        $this->assertContains('In Progress', Task::STATUSES);
        $this->assertContains('Under Review', Task::STATUSES);
        $this->assertContains('Returned', Task::STATUSES);
        $this->assertContains('Completed', Task::STATUSES);
    }

    // =========================================================================
    // SECTION 2 — TASK PERSISTENCE & RELATIONSHIPS
    // =========================================================================

    /** 7. Task can be created and persists with correct data. */
    public function test_task_can_be_created_and_persists(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff);
        $member    = $this->createVerifiedUser();
        $this->assignRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committee->id);

        $task = $this->createTask($activity, $member, [
            'title'       => 'Print badges',
            'description' => 'Use ITASK template.',
            'status'      => Task::STATUS_TO_DO,
            'due_date'    => '2026-10-15',
        ]);

        $this->assertDatabaseHas('tasks', [
            'id'          => $task->id,
            'activity_id' => $activity->id,
            'assigned_to' => $member->id,
            'title'       => 'Print badges',
            'status'      => 'To Do',
            'due_date'    => '2026-10-15',
        ]);
    }

    /** 8. Task belongs to correct Activity. */
    public function test_task_belongs_to_correct_activity(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff);
        $task      = $this->createTask($activity);

        $this->assertEquals($activity->id, $task->activity->id);
        $this->assertEquals($activity->title, $task->activity->title);
    }

    /** 9. Activity belongs to correct Committee via task relationship chain. */
    public function test_task_activity_belongs_to_correct_committee(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff);
        $task      = $this->createTask($activity);

        $this->assertEquals($committee->id, $task->activity->committee->id);
        $this->assertEquals($project->id, $task->activity->committee->project->id);
    }

    /** 10. Activity->tasks() relationship works. */
    public function test_activity_has_tasks_relationship(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff);

        $task1 = $this->createTask($activity, null, ['title' => 'Task One']);
        $task2 = $this->createTask($activity, null, ['title' => 'Task Two']);

        $activity->refresh();
        $this->assertCount(2, $activity->tasks);
        $this->assertTrue($activity->tasks->contains('id', $task1->id));
        $this->assertTrue($activity->tasks->contains('id', $task2->id));
    }

    /** 11. Task can be updated and changes persist. */
    public function test_task_can_be_updated_and_persists(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff);
        $task      = $this->createTask($activity);

        $task->update([
            'title'  => 'Updated Task Title',
            'status' => Task::STATUS_IN_PROGRESS,
        ]);

        $this->assertDatabaseHas('tasks', [
            'id'     => $task->id,
            'title'  => 'Updated Task Title',
            'status' => 'In Progress',
        ]);
    }

    // =========================================================================
    // SECTION 3 — ALL FIVE TASK STATUSES PERSIST
    // =========================================================================

    /** 12. All five statuses persist correctly through HTTP endpoint. */
    public function test_all_five_task_statuses_persist(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff);

        foreach (Task::STATUSES as $status) {
            $task = $this->createTask($activity, null, ['status' => $status]);
            $this->assertDatabaseHas('tasks', ['id' => $task->id, 'status' => $status]);
            $task->refresh();
            $this->assertSame($status, $task->status);
        }
    }

    /** 13. All five statuses are accepted by store validation. */
    public function test_all_five_task_statuses_accepted_by_store(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff);

        foreach (Task::STATUSES as $status) {
            $response = $this->actingAs($staff)->post(
                $this->taskRoute($project, $committee, $activity),
                ['title' => 'Task ' . $status, 'status' => $status]
            );
            $response->assertSessionDoesntHaveErrors('status');
        }
    }

    /** 14. Invalid task status is rejected. */
    public function test_invalid_task_status_is_rejected(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff);

        $response = $this->actingAs($staff)->post(
            $this->taskRoute($project, $committee, $activity),
            ['title' => 'Task', 'status' => 'INVALID_STATUS']
        );

        $response->assertSessionHasErrors('status');
    }

    // =========================================================================
    // SECTION 4 — TASK ASSIGNMENT
    // =========================================================================

    /** 15. Eligible project member can be assigned to a task. */
    public function test_eligible_member_can_be_assigned_to_task(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff);
        $member    = $this->createVerifiedUser();
        $this->assignRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committee->id);

        $response = $this->actingAs($staff)->post(
            $this->taskRoute($project, $committee, $activity),
            ['title' => 'Assigned Task', 'assigned_to' => $member->id, 'status' => Task::STATUS_TO_DO]
        );

        $response->assertSessionDoesntHaveErrors();
        $this->assertDatabaseHas('tasks', ['title' => 'Assigned Task', 'assigned_to' => $member->id]);
    }

    /** 16. Assignment persists correctly and resolves through assignee() relationship. */
    public function test_task_assignment_persists_and_resolves(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff);
        $member    = $this->createVerifiedUser();
        $this->assignRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committee->id);

        $task = $this->createTask($activity, $member);
        $task->refresh();

        $this->assertNotNull($task->assignee);
        $this->assertEquals($member->id, $task->assignee->id);
        $this->assertEquals($member->name, $task->assignee->name);
    }

    /** 17. Personnel from another project cannot be assigned. */
    public function test_personnel_from_another_project_cannot_be_assigned(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff);

        // User only in a different project
        $leader2   = $this->createVerifiedUser();
        $project2  = $this->createProjectWithLeader($leader2);
        $outsider  = $this->createVerifiedUser();
        $this->assignRole($project2, $outsider, ProjectRoleAssignment::ROLE_PROJECT_MEMBER);

        $response = $this->actingAs($staff)->post(
            $this->taskRoute($project, $committee, $activity),
            ['title' => 'Task', 'assigned_to' => $outsider->id, 'status' => Task::STATUS_TO_DO]
        );

        $response->assertSessionHasErrors('assigned_to');
    }

    /** 18. Unassigned user cannot be assigned. */
    public function test_unassigned_user_cannot_be_assigned(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff);
        $outsider  = $this->createVerifiedUser();  // Not assigned to any project

        $response = $this->actingAs($staff)->post(
            $this->taskRoute($project, $committee, $activity),
            ['title' => 'Task', 'assigned_to' => $outsider->id, 'status' => Task::STATUS_TO_DO]
        );

        $response->assertSessionHasErrors('assigned_to');
    }

    /** 19. Unverified user cannot be assigned. */
    public function test_unverified_user_cannot_be_assigned(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff);

        $unverified = User::create([
            'name'     => 'Unverified',
            'email'    => 'unverified_' . uniqid() . '@carsu.edu.ph',
            'password' => 'SecurePass123!',
        ]);
        $this->assignRole($project, $unverified, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committee->id);

        $response = $this->actingAs($staff)->post(
            $this->taskRoute($project, $committee, $activity),
            ['title' => 'Task', 'assigned_to' => $unverified->id, 'status' => Task::STATUS_TO_DO]
        );

        $response->assertSessionHasErrors('assigned_to');
    }

    /** 20. Null assignee is accepted (unassigned task). */
    public function test_null_assignee_is_accepted(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff);

        $response = $this->actingAs($staff)->post(
            $this->taskRoute($project, $committee, $activity),
            ['title' => 'Unassigned Task', 'assigned_to' => null, 'status' => Task::STATUS_TO_DO]
        );

        $response->assertSessionDoesntHaveErrors();
        $this->assertDatabaseHas('tasks', ['title' => 'Unassigned Task', 'assigned_to' => null]);
    }

    // =========================================================================
    // SECTION 5 — TASK DEADLINE VALIDATION
    // =========================================================================

    /** 21. Valid due date persists correctly. */
    public function test_valid_task_due_date_persists(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff);

        $response = $this->actingAs($staff)->post(
            $this->taskRoute($project, $committee, $activity),
            ['title' => 'Dated Task', 'due_date' => '2026-10-20', 'status' => Task::STATUS_TO_DO]
        );

        $response->assertSessionDoesntHaveErrors();
        $this->assertDatabaseHas('tasks', ['title' => 'Dated Task', 'due_date' => '2026-10-20']);
    }

    /** 22. Invalid due date format is rejected. */
    public function test_invalid_task_due_date_is_rejected(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff);

        $response = $this->actingAs($staff)->post(
            $this->taskRoute($project, $committee, $activity),
            ['title' => 'Task', 'due_date' => 'not-a-date', 'status' => Task::STATUS_TO_DO]
        );

        $response->assertSessionHasErrors('due_date');
    }

    /** 23. Null due date is accepted (optional). */
    public function test_null_task_due_date_is_accepted(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff);

        $response = $this->actingAs($staff)->post(
            $this->taskRoute($project, $committee, $activity),
            ['title' => 'No Due Date Task', 'due_date' => null, 'status' => Task::STATUS_TO_DO]
        );

        $response->assertSessionDoesntHaveErrors('due_date');
    }

    // =========================================================================
    // SECTION 6 — TASK VALIDATION
    // =========================================================================

    /** 24. Title is required. */
    public function test_task_title_is_required(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff);

        $response = $this->actingAs($staff)->post(
            $this->taskRoute($project, $committee, $activity),
            ['title' => '', 'status' => Task::STATUS_TO_DO]
        );

        $response->assertSessionHasErrors('title');
    }

    /** 25. Description is optional. */
    public function test_task_description_is_optional(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff);

        $response = $this->actingAs($staff)->post(
            $this->taskRoute($project, $committee, $activity),
            ['title' => 'No Description Task', 'status' => Task::STATUS_TO_DO]
        );

        $response->assertSessionDoesntHaveErrors('description');
        $this->assertDatabaseHas('tasks', ['title' => 'No Description Task', 'description' => null]);
    }

    // =========================================================================
    // SECTION 7 — TASK CREATION AUTHORIZATION
    // =========================================================================

    /** 26. Project Staff can create task in their committee. */
    public function test_project_staff_can_create_task(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff);

        $this->actingAs($staff)
            ->post($this->taskRoute($project, $committee, $activity), ['title' => 'Staff Task', 'status' => Task::STATUS_TO_DO])
            ->assertSessionDoesntHaveErrors();

        $this->assertDatabaseHas('tasks', ['title' => 'Staff Task']);
    }

    /** 27. Project Leader can create task in any committee. */
    public function test_project_leader_can_create_task(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff);

        $this->actingAs($leader)
            ->post($this->taskRoute($project, $committee, $activity), ['title' => 'Leader Task', 'status' => Task::STATUS_TO_DO])
            ->assertSessionDoesntHaveErrors();

        $this->assertDatabaseHas('tasks', ['title' => 'Leader Task']);
    }

    /** 28. Project Staff cannot create task in another committee. */
    public function test_project_staff_cannot_create_task_in_another_committee(): void
    {
        $leader     = $this->createVerifiedUser();
        $project    = $this->createProjectWithLeader($leader);
        $staffA     = $this->createVerifiedUser();
        $committeeA = $this->createCommitteeWithStaff($project, $staffA);
        $staffB     = $this->createVerifiedUser();
        $committeeB = $this->createCommitteeWithStaff($project, $staffB);
        $activityB  = $this->createActivity($committeeB, $staffB);

        $this->actingAs($staffA)
            ->post($this->taskRoute($project, $committeeB, $activityB), ['title' => 'Unauthorized Task', 'status' => Task::STATUS_TO_DO])
            ->assertForbidden();

        $this->assertDatabaseMissing('tasks', ['title' => 'Unauthorized Task']);
    }

    /** 29. Project Member cannot create tasks. */
    public function test_project_member_cannot_create_task(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff);
        $member    = $this->createVerifiedUser();
        $this->assignRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committee->id);

        $this->actingAs($member)
            ->post($this->taskRoute($project, $committee, $activity), ['title' => 'Member Task', 'status' => Task::STATUS_TO_DO])
            ->assertForbidden();
    }

    /** 30. Unassigned user cannot create tasks. */
    public function test_unassigned_user_cannot_create_task(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff);
        $outsider  = $this->createVerifiedUser();

        $this->actingAs($outsider)
            ->post($this->taskRoute($project, $committee, $activity), ['title' => 'Outsider Task', 'status' => Task::STATUS_TO_DO])
            ->assertForbidden();
    }

    /** 31. Guest is redirected to login. */
    public function test_guest_is_redirected_to_login_on_task_create(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff);

        $this->post($this->taskRoute($project, $committee, $activity), ['title' => 'Guest Task', 'status' => Task::STATUS_TO_DO])
            ->assertRedirect('/login');
    }

    // =========================================================================
    // SECTION 8 — TASK EDIT AUTHORIZATION
    // =========================================================================

    /** 32. Project Staff can update task in their committee. */
    public function test_project_staff_can_update_task(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff);
        $task      = $this->createTask($activity);

        $this->actingAs($staff)
            ->patch($this->taskUpdateRoute($project, $committee, $activity, $task), [
                'title'  => 'Staff Updated Task',
                'status' => Task::STATUS_IN_PROGRESS,
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('tasks', ['id' => $task->id, 'title' => 'Staff Updated Task']);
    }

    /** 33. Project Leader can update task in any committee. */
    public function test_project_leader_can_update_task(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff);
        $task      = $this->createTask($activity);

        $this->actingAs($leader)
            ->patch($this->taskUpdateRoute($project, $committee, $activity, $task), [
                'title'  => 'Leader Updated Task',
                'status' => Task::STATUS_COMPLETED,
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('tasks', ['id' => $task->id, 'title' => 'Leader Updated Task']);
    }

    /** 34. Assigned project member can update task status only. */
    public function test_assigned_member_can_update_task_status(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff);
        $member    = $this->createVerifiedUser();
        $this->assignRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committee->id);
        $task = $this->createTask($activity, $member);

        $this->actingAs($member)
            ->patch($this->taskUpdateRoute($project, $committee, $activity, $task), [
                'status' => Task::STATUS_IN_PROGRESS,
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('tasks', ['id' => $task->id, 'status' => Task::STATUS_IN_PROGRESS]);
    }

    /** 35. Assigned member cannot edit management fields (title, description, due_date, assigned_to). */
    public function test_assigned_member_cannot_edit_management_fields(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff);
        $member    = $this->createVerifiedUser();
        $this->assignRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committee->id);
        $task = $this->createTask($activity, $member);

        $this->actingAs($member)
            ->patch($this->taskUpdateRoute($project, $committee, $activity, $task), [
                'title'  => 'Member Attempted Title Edit',
                'status' => Task::STATUS_IN_PROGRESS,
            ])
            ->assertForbidden();

        $this->assertDatabaseMissing('tasks', ['title' => 'Member Attempted Title Edit']);
    }

    /** 36. Project Staff cannot update task in another committee. */
    public function test_project_staff_cannot_update_another_committees_task(): void
    {
        $leader     = $this->createVerifiedUser();
        $project    = $this->createProjectWithLeader($leader);
        $staffA     = $this->createVerifiedUser();
        $committeeA = $this->createCommitteeWithStaff($project, $staffA);
        $staffB     = $this->createVerifiedUser();
        $committeeB = $this->createCommitteeWithStaff($project, $staffB);
        $activityB  = $this->createActivity($committeeB, $staffB);
        $taskB      = $this->createTask($activityB);

        $this->actingAs($staffA)
            ->patch($this->taskUpdateRoute($project, $committeeB, $activityB, $taskB), [
                'title'  => 'Malicious Edit',
                'status' => Task::STATUS_COMPLETED,
            ])
            ->assertForbidden();
    }

    /** 37. Project Member cannot update task they are NOT assigned to. */
    public function test_unassigned_member_cannot_update_task(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff);
        $task      = $this->createTask($activity); // no assignee
        $member    = $this->createVerifiedUser();
        $this->assignRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committee->id);

        $this->actingAs($member)
            ->patch($this->taskUpdateRoute($project, $committee, $activity, $task), [
                'status' => Task::STATUS_IN_PROGRESS,
            ])
            ->assertForbidden();
    }

    // =========================================================================
    // SECTION 9 — TASK CROSS-PROJECT ISOLATION
    // =========================================================================

    /** 38. Cross-project task access is denied (403/404). */
    public function test_cross_project_task_access_is_denied(): void
    {
        $leader1    = $this->createVerifiedUser();
        $project1   = $this->createProjectWithLeader($leader1);
        $staff1     = $this->createVerifiedUser();
        $committee1 = $this->createCommitteeWithStaff($project1, $staff1);
        $activity1  = $this->createActivity($committee1, $staff1);
        $task1      = $this->createTask($activity1);

        $leader2    = $this->createVerifiedUser();
        $project2   = $this->createProjectWithLeader($leader2);
        $staff2     = $this->createVerifiedUser();
        $committee2 = $this->createCommitteeWithStaff($project2, $staff2);
        $activity2  = $this->createActivity($committee2, $staff2);

        // staff2 tries to update task1 via project2 context — should 404
        $this->actingAs($staff2)
            ->patch("/projects/{$project2->id}/committees/{$committee2->id}/activities/{$activity2->id}/tasks/{$task1->id}", [
                'title'  => 'Malicious update',
                'status' => Task::STATUS_COMPLETED,
            ])
            ->assertNotFound();
    }

    /** 39. Task from another activity within same committee returns 404. */
    public function test_task_from_different_activity_same_committee_returns_404(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activityA = $this->createActivity($committee, $staff);
        $activityB = $this->createActivity($committee, $staff);
        $taskA     = $this->createTask($activityA);

        // taskA belongs to activityA, not activityB
        $this->actingAs($staff)
            ->patch("/projects/{$project->id}/committees/{$committee->id}/activities/{$activityB->id}/tasks/{$taskA->id}", [
                'title'  => 'Orphan update',
                'status' => Task::STATUS_IN_PROGRESS,
            ])
            ->assertNotFound();
    }

    // =========================================================================
    // SECTION 10 — CHECKLIST ITEM PERSISTENCE & RELATIONSHIPS
    // =========================================================================

    /** 40. Checklist item can be created and persists. */
    public function test_checklist_item_can_be_created_and_persists(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff);
        $task      = $this->createTask($activity);

        $response = $this->actingAs($staff)->post(
            $this->checklistRoute($project, $committee, $activity, $task),
            ['content' => 'Prepare registration forms', 'is_completed' => false]
        );

        $response->assertSessionDoesntHaveErrors();
        $this->assertDatabaseHas('checklist_items', [
            'task_id'      => $task->id,
            'content'      => 'Prepare registration forms',
            'is_completed' => false,
        ]);
    }

    /** 41. Checklist item belongs to correct task via relationship. */
    public function test_checklist_item_belongs_to_task(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff);
        $task      = $this->createTask($activity);
        $item      = $this->createChecklistItem($task);

        $this->assertEquals($task->id, $item->task->id);
    }

    /** 42. Task has checklist items relationship. */
    public function test_task_has_checklist_items_relationship(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff);
        $task      = $this->createTask($activity);

        $item1 = $this->createChecklistItem($task, ['content' => 'Item One']);
        $item2 = $this->createChecklistItem($task, ['content' => 'Item Two']);

        $task->refresh();
        $this->assertCount(2, $task->checklistItems);
        $this->assertTrue($task->checklistItems->contains('id', $item1->id));
        $this->assertTrue($task->checklistItems->contains('id', $item2->id));
    }

    /** 43. Checklist item completion state can be toggled. */
    public function test_checklist_item_completion_can_be_toggled(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff);
        $task      = $this->createTask($activity);
        $item      = $this->createChecklistItem($task, ['is_completed' => false]);

        // Mark complete
        $this->actingAs($staff)
            ->patch($this->checklistItemRoute($project, $committee, $activity, $task, $item), ['is_completed' => true])
            ->assertRedirect();

        $this->assertDatabaseHas('checklist_items', ['id' => $item->id, 'is_completed' => true]);

        // Mark incomplete
        $this->actingAs($staff)
            ->patch($this->checklistItemRoute($project, $committee, $activity, $task, $item), ['is_completed' => false])
            ->assertRedirect();

        $this->assertDatabaseHas('checklist_items', ['id' => $item->id, 'is_completed' => false]);
    }

    /** 44. Checklist item content can be updated. */
    public function test_checklist_item_content_can_be_updated(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff);
        $task      = $this->createTask($activity);
        $item      = $this->createChecklistItem($task, ['content' => 'Old content']);

        $this->actingAs($staff)
            ->patch($this->checklistItemRoute($project, $committee, $activity, $task, $item), ['content' => 'Updated content'])
            ->assertRedirect();

        $this->assertDatabaseHas('checklist_items', ['id' => $item->id, 'content' => 'Updated content']);
    }

    /** 45. Checklist item can be deleted. */
    public function test_checklist_item_can_be_deleted(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff);
        $task      = $this->createTask($activity);
        $item      = $this->createChecklistItem($task, ['content' => 'To be deleted']);

        $this->actingAs($staff)
            ->delete($this->checklistItemRoute($project, $committee, $activity, $task, $item))
            ->assertRedirect();

        $this->assertDatabaseMissing('checklist_items', ['id' => $item->id]);
    }

    // =========================================================================
    // SECTION 11 — CHECKLIST VALIDATION
    // =========================================================================

    /** 46. Content is required for checklist items. */
    public function test_checklist_item_content_is_required(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff);
        $task      = $this->createTask($activity);

        $this->actingAs($staff)
            ->post($this->checklistRoute($project, $committee, $activity, $task), ['content' => ''])
            ->assertSessionHasErrors('content');
    }

    /** 47. Content exceeding 500 chars is rejected. */
    public function test_checklist_item_content_max_length_is_enforced(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff);
        $task      = $this->createTask($activity);

        $this->actingAs($staff)
            ->post($this->checklistRoute($project, $committee, $activity, $task), ['content' => str_repeat('x', 501)])
            ->assertSessionHasErrors('content');
    }

    /** 48. is_completed must be boolean. */
    public function test_checklist_item_is_completed_must_be_boolean(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff);
        $task      = $this->createTask($activity);
        $item      = $this->createChecklistItem($task);

        $this->actingAs($staff)
            ->patch($this->checklistItemRoute($project, $committee, $activity, $task, $item), ['is_completed' => 'not-a-boolean'])
            ->assertSessionHasErrors('is_completed');
    }

    // =========================================================================
    // SECTION 12 — CHECKLIST AUTHORIZATION
    // =========================================================================

    /** 49. Project Leader can create checklist items. */
    public function test_project_leader_can_create_checklist_item(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff);
        $task      = $this->createTask($activity);

        $this->actingAs($leader)
            ->post($this->checklistRoute($project, $committee, $activity, $task), ['content' => 'Leader checklist item'])
            ->assertSessionDoesntHaveErrors();

        $this->assertDatabaseHas('checklist_items', ['task_id' => $task->id, 'content' => 'Leader checklist item']);
    }

    /** 50. Project Staff can create checklist items in their committee. */
    public function test_project_staff_can_create_checklist_item(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff);
        $task      = $this->createTask($activity);

        $this->actingAs($staff)
            ->post($this->checklistRoute($project, $committee, $activity, $task), ['content' => 'Staff checklist item'])
            ->assertSessionDoesntHaveErrors();

        $this->assertDatabaseHas('checklist_items', ['task_id' => $task->id, 'content' => 'Staff checklist item']);
    }

    /** 51. Project Staff cannot create checklist items in another committee. */
    public function test_project_staff_cannot_create_checklist_item_in_another_committee(): void
    {
        $leader     = $this->createVerifiedUser();
        $project    = $this->createProjectWithLeader($leader);
        $staffA     = $this->createVerifiedUser();
        $committeeA = $this->createCommitteeWithStaff($project, $staffA);
        $staffB     = $this->createVerifiedUser();
        $committeeB = $this->createCommitteeWithStaff($project, $staffB);
        $activityB  = $this->createActivity($committeeB, $staffB);
        $taskB      = $this->createTask($activityB);

        $this->actingAs($staffA)
            ->post($this->checklistRoute($project, $committeeB, $activityB, $taskB), ['content' => 'Unauthorized checklist item'])
            ->assertForbidden();

        $this->assertDatabaseMissing('checklist_items', ['content' => 'Unauthorized checklist item']);
    }

    /** 52. Project Member cannot create checklist items. */
    public function test_project_member_cannot_create_checklist_item(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff);
        $task      = $this->createTask($activity);
        $member    = $this->createVerifiedUser();
        $this->assignRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committee->id);

        $this->actingAs($member)
            ->post($this->checklistRoute($project, $committee, $activity, $task), ['content' => 'Member checklist item'])
            ->assertForbidden();
    }

    /** 53. Unassigned user cannot create checklist items. */
    public function test_unassigned_user_cannot_create_checklist_item(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff);
        $task      = $this->createTask($activity);
        $outsider  = $this->createVerifiedUser();

        $this->actingAs($outsider)
            ->post($this->checklistRoute($project, $committee, $activity, $task), ['content' => 'Outsider checklist item'])
            ->assertForbidden();
    }

    /** 54. Guest is redirected to login on checklist create. */
    public function test_guest_is_redirected_to_login_on_checklist_create(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff);
        $task      = $this->createTask($activity);

        $this->post($this->checklistRoute($project, $committee, $activity, $task), ['content' => 'Guest checklist item'])
            ->assertRedirect('/login');
    }

    /** 55. Project Member cannot update checklist items. */
    public function test_project_member_cannot_update_checklist_item(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff);
        $task      = $this->createTask($activity);
        $item      = $this->createChecklistItem($task);
        $member    = $this->createVerifiedUser();
        $this->assignRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committee->id);

        $this->actingAs($member)
            ->patch($this->checklistItemRoute($project, $committee, $activity, $task, $item), ['is_completed' => true])
            ->assertForbidden();
    }

    /** 56. Project Member cannot delete checklist items. */
    public function test_project_member_cannot_delete_checklist_item(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff);
        $task      = $this->createTask($activity);
        $item      = $this->createChecklistItem($task);
        $member    = $this->createVerifiedUser();
        $this->assignRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committee->id);

        $this->actingAs($member)
            ->delete($this->checklistItemRoute($project, $committee, $activity, $task, $item))
            ->assertForbidden();

        $this->assertDatabaseHas('checklist_items', ['id' => $item->id]);
    }

    // =========================================================================
    // SECTION 13 — CHECKLIST CROSS-PROJECT ISOLATION & ROUTE TAMPERING
    // =========================================================================

    /** 57. Cross-project checklist access is denied with 404. */
    public function test_cross_project_checklist_item_access_is_denied(): void
    {
        $leader1    = $this->createVerifiedUser();
        $project1   = $this->createProjectWithLeader($leader1);
        $staff1     = $this->createVerifiedUser();
        $committee1 = $this->createCommitteeWithStaff($project1, $staff1);
        $activity1  = $this->createActivity($committee1, $staff1);
        $task1      = $this->createTask($activity1);
        $item1      = $this->createChecklistItem($task1);

        $leader2    = $this->createVerifiedUser();
        $project2   = $this->createProjectWithLeader($leader2);
        $staff2     = $this->createVerifiedUser();
        $committee2 = $this->createCommitteeWithStaff($project2, $staff2);
        $activity2  = $this->createActivity($committee2, $staff2);
        $task2      = $this->createTask($activity2);

        // staff2 tries to access item1 via project2/committee2/activity2/task2
        $this->actingAs($staff2)
            ->patch("/projects/{$project2->id}/committees/{$committee2->id}/activities/{$activity2->id}/tasks/{$task2->id}/checklist/{$item1->id}", ['is_completed' => true])
            ->assertNotFound();

        $this->actingAs($staff2)
            ->delete("/projects/{$project2->id}/committees/{$committee2->id}/activities/{$activity2->id}/tasks/{$task2->id}/checklist/{$item1->id}")
            ->assertNotFound();
    }

    /** 58. Checklist item from another task in same activity returns 404. */
    public function test_checklist_item_from_different_task_returns_404(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff);
        $taskA     = $this->createTask($activity);
        $taskB     = $this->createTask($activity);
        $itemA     = $this->createChecklistItem($taskA);

        // itemA belongs to taskA, not taskB
        $this->actingAs($staff)
            ->patch("/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}/tasks/{$taskB->id}/checklist/{$itemA->id}", ['is_completed' => true])
            ->assertNotFound();

        $this->actingAs($staff)
            ->delete("/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}/tasks/{$taskB->id}/checklist/{$itemA->id}")
            ->assertNotFound();
    }

    /** 59. Mismatched project+committee on checklist store returns 404. */
    public function test_mismatched_hierarchy_on_checklist_store_returns_404(): void
    {
        $leader1    = $this->createVerifiedUser();
        $project1   = $this->createProjectWithLeader($leader1);
        $staff1     = $this->createVerifiedUser();
        $committee1 = $this->createCommitteeWithStaff($project1, $staff1);
        $activity1  = $this->createActivity($committee1, $staff1);
        $task1      = $this->createTask($activity1);

        $leader2    = $this->createVerifiedUser();
        $project2   = $this->createProjectWithLeader($leader2);
        $staff2     = $this->createVerifiedUser();
        $committee2 = $this->createCommitteeWithStaff($project2, $staff2);

        // committee2 doesn't belong to project1
        $this->actingAs($staff1)
            ->post("/projects/{$project1->id}/committees/{$committee2->id}/activities/{$activity1->id}/tasks/{$task1->id}/checklist", ['content' => 'Orphan item'])
            ->assertNotFound();
    }

    // =========================================================================
    // SECTION 14 — ACTIVITY SHOW RESPONSE INCLUDES CHECKLIST ITEMS
    // =========================================================================

    /** 60. Activity show response includes checklist_items for each task. */
    public function test_activity_show_response_includes_checklist_items_for_tasks(): void
    {
        $leader    = $this->createVerifiedUser();
        $project   = $this->createProjectWithLeader($leader);
        $staff     = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $activity  = $this->createActivity($committee, $staff);
        $task      = $this->createTask($activity);
        $item1     = $this->createChecklistItem($task, ['content' => 'First item', 'is_completed' => false]);
        $item2     = $this->createChecklistItem($task, ['content' => 'Second item', 'is_completed' => true]);

        $response = $this->actingAs($leader)
            ->get("/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}");

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Activities/Show')
            ->has('activity.tasks', 1)
            ->has('activity.tasks.0.checklist_items', 2)
            ->where('activity.tasks.0.checklist_items.0.content', 'First item')
            ->where('activity.tasks.0.checklist_items.0.is_completed', false)
            ->where('activity.tasks.0.checklist_items.1.content', 'Second item')
            ->where('activity.tasks.0.checklist_items.1.is_completed', true)
        );
    }
}
