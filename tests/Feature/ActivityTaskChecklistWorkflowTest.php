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
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Day 10 — Person B: Activities + Tasks/Checklists UI & Workflow Verification
 *
 * Verifies:
 * - Real backend data flow through Inertia props for Committees/Show and Activities/Show
 * - Activity start_date, due_date, status, and permissions
 * - Task list, assignment, statuses, due_date, and permissions
 * - Checklist items in task detail context with toggle, create, update, delete
 * - manageChecklist permission gating (Leader/Staff allowed, Member disallowed)
 * - Complete hierarchy navigation and persistence: Project -> Committee -> Activity -> Task -> Checklist
 */
class ActivityTaskChecklistWorkflowTest extends TestCase
{
    use RefreshDatabase;

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

        $this->assignRole($project, $staff, ProjectRoleAssignment::ROLE_PROJECT_STAFF, $committee->id);

        return $committee;
    }

    // =========================================================================
    // 1. COMMITTEE SHOW INERTIA PROPS (Activity list with dates, statuses, permissions)
    // =========================================================================

    public function test_committee_show_inertia_response_contains_activities_with_dates_and_statuses(): void
    {
        $leader = $this->createVerifiedUser();
        $staff  = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);
        $committee = $this->createCommitteeWithStaff($project, $staff);

        $activity = Activity::create([
            'project_id'   => $project->id,
            'committee_id' => $committee->id,
            'created_by'   => $staff->id,
            'title'        => 'Sprint Planning Activity',
            'description'  => 'Plan the sprint details',
            'status'       => Activity::STATUS_IN_PROGRESS,
            'start_date'   => '2026-10-01',
            'due_date'     => '2026-10-15',
        ]);

        $response = $this->actingAs($staff)->get(
            route('projects.committees.show', [$project, $committee])
        );

        $response->assertStatus(200);
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Committees/Show')
            ->has('committee')
            ->has('committee.activities', 1)
            ->where('committee.activities.0.id', (string) $activity->id)
            ->where('committee.activities.0.title', 'Sprint Planning Activity')
            ->where('committee.activities.0.status', Activity::STATUS_IN_PROGRESS)
            ->where('committee.activities.0.start_date_raw', '2026-10-01')
            ->where('committee.activities.0.due_date_raw', '2026-10-15')
        );
    }

    // =========================================================================
    // 2. ACTIVITY SHOW INERTIA PROPS (Dates, tasks with checklists, manageChecklist gate)
    // =========================================================================

    public function test_activity_show_inertia_response_contains_activity_dates_and_tasks_with_checklist_and_permissions(): void
    {
        $leader = $this->createVerifiedUser();
        $staff  = $this->createVerifiedUser();
        $member = $this->createVerifiedUser();

        $project = $this->createProjectWithLeader($leader);
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $this->assignRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committee->id);

        $activity = Activity::create([
            'project_id'   => $project->id,
            'committee_id' => $committee->id,
            'created_by'   => $staff->id,
            'title'        => 'Core Architecture Activity',
            'status'       => Activity::STATUS_TO_DO,
            'start_date'   => '2026-10-05',
            'due_date'     => '2026-10-20',
        ]);

        $task = Task::create([
            'activity_id' => $activity->id,
            'assigned_to' => $member->id,
            'title'       => 'Build Database Migrations',
            'description' => 'Create schema tables',
            'status'      => Task::STATUS_IN_PROGRESS,
            'due_date'    => '2026-10-12',
        ]);

        $item1 = ChecklistItem::create([
            'task_id'      => $task->id,
            'content'      => 'Design ERD',
            'is_completed' => true,
            'order'        => 0,
        ]);

        $item2 = ChecklistItem::create([
            'task_id'      => $task->id,
            'content'      => 'Run migrations',
            'is_completed' => false,
            'order'        => 1,
        ]);

        // 1. Staff perspective: can manage task and checklist
        $staffResponse = $this->actingAs($staff)->get(
            route('projects.committees.activities.show', [$project, $committee, $activity])
        );

        $staffResponse->assertStatus(200);
        $staffResponse->assertInertia(fn (Assert $page) => $page
            ->component('Activities/Show')
            ->where('activity.id', (string) $activity->id)
            ->where('activity.start_date_raw', '2026-10-05')
            ->where('activity.due_date_raw', '2026-10-20')
            ->has('activity.tasks', 1)
            ->where('activity.tasks.0.id', (string) $task->id)
            ->where('activity.tasks.0.title', 'Build Database Migrations')
            ->where('activity.tasks.0.status', Task::STATUS_IN_PROGRESS)
            ->where('activity.tasks.0.can.manageChecklist', false)
            ->where('activity.tasks.0.can.update', true)
            ->has('activity.tasks.0.checklist_items', 2)
            ->where('activity.tasks.0.checklist_items.0.id', (string) $item1->id)
            ->where('activity.tasks.0.checklist_items.0.is_completed', true)
            ->where('activity.tasks.0.checklist_items.1.id', (string) $item2->id)
            ->where('activity.tasks.0.checklist_items.1.is_completed', false)
        );

        // 2. Member perspective: can update status (assigned), and CAN manageChecklist (assigned)
        $memberResponse = $this->actingAs($member)->get(
            route('projects.committees.activities.show', [$project, $committee, $activity])
        );

        $memberResponse->assertStatus(200);
        $memberResponse->assertInertia(fn (Assert $page) => $page
            ->component('Activities/Show')
            ->where('activity.tasks.0.can.updateStatus', true)
            ->where('activity.tasks.0.can.manageChecklist', true)
        );
    }

    // =========================================================================
    // 3. FULL HIERARCHY WORKFLOW & PERSISTENCE (Real Database Records)
    // =========================================================================

    public function test_complete_hierarchy_workflow_and_persistence_with_real_records(): void
    {
        // Step 1: Users & Project Hierarchy
        $leader = $this->createVerifiedUser(['name' => 'Leader Maria']);
        $staff  = $this->createVerifiedUser(['name' => 'Staff Juan']);
        $member = $this->createVerifiedUser(['name' => 'Member Pedro']);
        $otherMember = $this->createVerifiedUser(['name' => 'Other Member Ana']);

        $project = $this->createProjectWithLeader($leader, ['title' => 'Capstone ITASK 2026']);
        $committee = $this->createCommitteeWithStaff($project, $staff);
        $this->assignRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committee->id);
        $this->assignRole($project, $otherMember, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committee->id);

        // Step 2: Staff creates Activity with start_date and due_date
        $activityPayload = [
            'title'       => 'Frontend & Backend Integration',
            'description' => 'Connect Inertia pages with Day 9 backend.',
            'status'      => Activity::STATUS_TO_DO,
            'start_date'  => '2026-10-01',
            'due_date'    => '2026-10-10',
        ];

        $activityStoreResponse = $this->actingAs($staff)->post(
            route('projects.committees.activities.store', [$project, $committee]),
            $activityPayload
        );
        $activityStoreResponse->assertRedirect();

        $this->assertDatabaseHas('activities', [
            'project_id'   => $project->id,
            'committee_id' => $committee->id,
            'title'        => 'Frontend & Backend Integration',
            'start_date'   => '2026-10-01 00:00:00',
            'due_date'     => '2026-10-10 00:00:00',
            'status'       => Activity::STATUS_TO_DO,
        ]);

        $activity = Activity::where('title', 'Frontend & Backend Integration')->firstOrFail();

        // Step 3: Staff creates Task assigned to Member
        $taskPayload = [
            'title'       => 'Connect Checklist UI',
            'description' => 'Wire checklist item toggle and CRUD to Inertia.',
            'assigned_to' => $member->id,
            'due_date'    => '2026-10-08',
            'status'      => Task::STATUS_TO_DO,
        ];

        $taskStoreResponse = $this->actingAs($staff)->post(
            route('projects.committees.activities.tasks.store', [$project, $committee, $activity]),
            $taskPayload
        );
        $taskStoreResponse->assertRedirect();

        $this->assertDatabaseHas('tasks', [
            'activity_id' => $activity->id,
            'assigned_to' => $member->id,
            'title'       => 'Connect Checklist UI',
            'due_date'    => '2026-10-08',
            'status'      => Task::STATUS_TO_DO,
        ]);

        $task = Task::where('title', 'Connect Checklist UI')->firstOrFail();

        // Step 4: Assigned Member adds 3 Checklist Items to their Task
        $item1Response = $this->actingAs($member)->post(
            route('projects.committees.activities.tasks.checklist.store', [$project, $committee, $activity, $task]),
            ['content' => 'Implement Modal']
        );
        $item1Response->assertRedirect();

        $item2Response = $this->actingAs($member)->post(
            route('projects.committees.activities.tasks.checklist.store', [$project, $committee, $activity, $task]),
            ['content' => 'Connect Toggle Inertia Form']
        );
        $item2Response->assertRedirect();

        $item3Response = $this->actingAs($member)->post(
            route('projects.committees.activities.tasks.checklist.store', [$project, $committee, $activity, $task]),
            ['content' => 'Verify 5 Status Transitions']
        );
        $item3Response->assertRedirect();

        $this->assertEquals(3, ChecklistItem::where('task_id', $task->id)->count());

        $item1 = ChecklistItem::where('task_id', $task->id)->where('content', 'Implement Modal')->firstOrFail();
        $item2 = ChecklistItem::where('task_id', $task->id)->where('content', 'Connect Toggle Inertia Form')->firstOrFail();
        $item3 = ChecklistItem::where('task_id', $task->id)->where('content', 'Verify 5 Status Transitions')->firstOrFail();

        // Step 5: Assigned Member toggles checklist item completion
        $patchResponse = $this->actingAs($member)->patch(
            route('projects.committees.activities.tasks.checklist.update', [$project, $committee, $activity, $task, $item1]),
            ['is_completed' => true]
        );
        $patchResponse->assertRedirect();

        $this->assertDatabaseHas('checklist_items', [
            'id'           => $item1->id,
            'is_completed' => true,
        ]);

        // Step 6: Assigned Member updates status: To Do -> In Progress -> Completed (no review required)
        $status1Response = $this->actingAs($member)->patch(
            route('projects.committees.activities.tasks.update', [$project, $committee, $activity, $task]),
            ['status' => Task::STATUS_IN_PROGRESS]
        );
        $status1Response->assertRedirect();
        $this->assertEquals(Task::STATUS_IN_PROGRESS, $task->fresh()->status);

        $status2Response = $this->actingAs($member)->patch(
            route('projects.committees.activities.tasks.update', [$project, $committee, $activity, $task]),
            ['status' => Task::STATUS_COMPLETED]
        );
        $status2Response->assertRedirect();
        $this->assertEquals(Task::STATUS_COMPLETED, $task->fresh()->status);

        // Step 7: Verify Staff cannot directly modify assigned member's status (403 Forbidden)
        $staffStatusPatch = $this->actingAs($staff)->patch(
            route('projects.committees.activities.tasks.update', [$project, $committee, $activity, $task]),
            ['status' => Task::STATUS_IN_PROGRESS]
        );
        $staffStatusPatch->assertStatus(403);

        // Step 8: Verify Leader cannot directly modify assigned member's status (403 Forbidden)
        $leaderStatusPatch = $this->actingAs($leader)->patch(
            route('projects.committees.activities.tasks.update', [$project, $committee, $activity, $task]),
            ['status' => Task::STATUS_IN_PROGRESS]
        );
        $leaderStatusPatch->assertStatus(403);

        // Step 9: Verify Unassigned Member cannot modify checklist items (403 Forbidden)
        $forbiddenChecklistCreate = $this->actingAs($otherMember)->post(
            route('projects.committees.activities.tasks.checklist.store', [$project, $committee, $activity, $task]),
            ['content' => 'Unauthorized item']
        );
        $forbiddenChecklistCreate->assertStatus(403);

        $forbiddenChecklistDelete = $this->actingAs($otherMember)->delete(
            route('projects.committees.activities.tasks.checklist.destroy', [$project, $committee, $activity, $task, $item3])
        );
        $forbiddenChecklistDelete->assertStatus(403);

        // Step 10: Refresh and verify state persists accurately
        $freshTask = Task::with('checklistItems')->find($task->id);
        $this->assertEquals(Task::STATUS_COMPLETED, $freshTask->status);
        $this->assertEquals(3, $freshTask->checklistItems->count());
        $this->assertEquals(1, $freshTask->checklistItems->where('is_completed', true)->count());
        $this->assertEquals(2, $freshTask->checklistItems->where('is_completed', false)->count());
    }
}
