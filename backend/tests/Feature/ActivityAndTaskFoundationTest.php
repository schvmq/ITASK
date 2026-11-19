<?php

namespace Tests\Feature;

use App\Models\Activity;
use App\Models\Committee;
use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ActivityAndTaskFoundationTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Helper to create a verified user.
     */
    protected function createVerifiedUser(array $attributes = []): User
    {
        $user = User::create(array_merge([
            'name' => 'Verified User ' . uniqid(),
            'email' => 'user_' . uniqid() . '@carsu.edu.ph',
            'password' => 'SecurePass123!',
        ], $attributes));

        $user->forceFill(['email_verified_at' => now()])->save();

        return $user;
    }

    /**
     * Helper to create a project with its initial Project Leader assignment.
     */
    protected function createProjectWithLeader(User $leader, array $attributes = []): Project
    {
        $project = Project::create(array_merge([
            'title' => 'Project ' . uniqid(),
            'description' => 'Test project description.',
            'status' => Project::STATUS_PLANNING,
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
    protected function assignProjectRole(Project $project, User $user, string $role, ?int $committeeId = null): ProjectRoleAssignment
    {
        return ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'user_id' => $user->id,
            'role' => $role,
            'committee_id' => $committeeId,
        ]);
    }

    /**
     * Helper to create a committee with an assigned Project Staff head.
     */
    protected function createCommitteeWithHead(Project $project, User $staffHead, array $attributes = []): Committee
    {
        $committee = Committee::create(array_merge([
            'project_id' => $project->id,
            'name' => 'Test Committee ' . uniqid(),
            'description' => 'A test committee description.',
        ], $attributes));

        $assignment = ProjectRoleAssignment::where('project_id', $project->id)
            ->where('user_id', $staffHead->id)
            ->first();

        if ($assignment) {
            $assignment->update([
                'role' => ProjectRoleAssignment::ROLE_PROJECT_STAFF,
                'committee_id' => $committee->id,
            ]);
        } else {
            $this->assignProjectRole($project, $staffHead, ProjectRoleAssignment::ROLE_PROJECT_STAFF, $committee->id);
        }

        return $committee;
    }

    /**
     * Helper to create an activity under a committee.
     */
    protected function createActivity(Committee $committee, User $creator, array $attributes = []): Activity
    {
        return Activity::create(array_merge([
            'project_id' => $committee->project_id,
            'committee_id' => $committee->id,
            'created_by' => $creator->id,
            'title' => 'Test Activity ' . uniqid(),
            'description' => 'Activity description',
            'status' => Activity::STATUS_TODO,
            'due_date' => now()->addDays(7)->format('Y-m-d'),
        ], $attributes));
    }

    /**
     * Helper to create a task under an activity.
     */
    protected function createTask(Activity $activity, ?User $assignee = null, array $attributes = []): Task
    {
        return Task::create(array_merge([
            'activity_id' => $activity->id,
            'assigned_to' => $assignee?->id,
            'title' => 'Test Task ' . uniqid(),
            'description' => 'Task description',
            'status' => Task::STATUS_TODO,
            'due_date' => now()->addDays(3)->format('Y-m-d'),
        ], $attributes));
    }

    // =========================================================================
    // ACTIVITIES TESTS (1 to 8)
    // =========================================================================

    /**
     * 1. Authorized Project Staff can create an Activity in their committee.
     */
    public function test_authorized_project_staff_can_create_activity_in_their_committee(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $staff = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithHead($project, $staff);

        $activityData = [
            'title' => 'Opening Ceremony Coordination',
            'description' => 'Manage stage setup and welcoming protocol.',
            'status' => Activity::STATUS_TODO,
            'due_date' => now()->addDays(14)->format('Y-m-d'),
        ];

        $response = $this->actingAs($staff)
            ->post("/projects/{$project->id}/committees/{$committee->id}/activities", $activityData);
        $createdActivity = Activity::where('title', 'Opening Ceremony Coordination')->firstOrFail();
        $response->assertRedirect("/projects/{$project->id}/committees/{$committee->id}/activities/{$createdActivity->id}");

        $this->assertDatabaseHas('activities', [
            'project_id' => $project->id,
            'committee_id' => $committee->id,
            'created_by' => $staff->id,
            'title' => 'Opening Ceremony Coordination',
            'status' => Activity::STATUS_TODO,
        ]);
    }

    /**
     * 2. Project Staff cannot create an Activity in another committee.
     */
    public function test_project_staff_cannot_create_activity_in_another_committee(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $staffA = $this->createVerifiedUser();
        $committeeA = $this->createCommitteeWithHead($project, $staffA);

        $staffB = $this->createVerifiedUser();
        $committeeB = $this->createCommitteeWithHead($project, $staffB);

        $activityData = [
            'title' => 'Unauthorized Activity Attempt',
            'description' => 'Attempting to inject activity into another committee.',
            'status' => Activity::STATUS_TODO,
        ];

        // Staff A attempts to create under Committee B
        $response = $this->actingAs($staffA)
            ->post("/projects/{$project->id}/committees/{$committeeB->id}/activities", $activityData);

        $response->assertForbidden();

        $this->assertDatabaseMissing('activities', [
            'title' => 'Unauthorized Activity Attempt',
        ]);
    }

    /**
     * 3. Project Staff can update an Activity in their own committee.
     */
    public function test_project_staff_can_update_activity_in_their_own_committee(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $staff = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithHead($project, $staff);
        $activity = $this->createActivity($committee, $staff, ['status' => Activity::STATUS_TODO]);

        $updateData = [
            'title' => 'Updated Activity Title',
            'description' => 'Updated activity description.',
            'status' => Activity::STATUS_IN_PROGRESS,
            'due_date' => now()->addDays(20)->format('Y-m-d'),
        ];

        $response = $this->actingAs($staff)
            ->patch("/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}", $updateData);

        $response->assertRedirect("/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}");

        $this->assertDatabaseHas('activities', [
            'id' => $activity->id,
            'title' => 'Updated Activity Title',
            'status' => Activity::STATUS_IN_PROGRESS,
        ]);
    }

    /**
     * 4. Project Staff cannot update an Activity in another committee.
     */
    public function test_project_staff_cannot_update_activity_in_another_committee(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $staffA = $this->createVerifiedUser();
        $committeeA = $this->createCommitteeWithHead($project, $staffA);

        $staffB = $this->createVerifiedUser();
        $committeeB = $this->createCommitteeWithHead($project, $staffB);
        $activityB = $this->createActivity($committeeB, $staffB);

        $response = $this->actingAs($staffA)
            ->patch("/projects/{$project->id}/committees/{$committeeB->id}/activities/{$activityB->id}", [
                'title' => 'Malicious Activity Edit',
                'status' => Activity::STATUS_IN_PROGRESS,
            ]);

        $response->assertForbidden();

        $this->assertDatabaseMissing('activities', [
            'title' => 'Malicious Activity Edit',
        ]);
    }

    /**
     * 5. Project Leader can view project activities.
     */
    public function test_project_leader_can_view_project_activities(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $staff = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithHead($project, $staff);
        $activity = $this->createActivity($committee, $staff);

        $response = $this->actingAs($leader)
            ->get("/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}");

        $response->assertOk();
    }

    /**
     * 6. Project Member can view relevant activities.
     */
    public function test_project_member_can_view_relevant_activities(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $staff = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithHead($project, $staff);
        $activity = $this->createActivity($committee, $staff);

        $member = $this->createVerifiedUser();
        $this->assignProjectRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committee->id);

        $response = $this->actingAs($member)
            ->get("/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}");

        $response->assertOk();
    }

    /**
     * 7. Unauthorized/unassigned users cannot access activities.
     */
    public function test_unauthorized_or_unassigned_users_cannot_access_activities(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $staff = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithHead($project, $staff);
        $activity = $this->createActivity($committee, $staff);

        $outsideUser = $this->createVerifiedUser();

        // View blocked
        $this->actingAs($outsideUser)
            ->get("/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}")
            ->assertForbidden();

        // Update blocked
        $this->actingAs($outsideUser)
            ->patch("/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}", [
                'title' => 'Outside update',
                'status' => Activity::STATUS_IN_PROGRESS,
            ])
            ->assertForbidden();

        // Delete blocked
        $this->actingAs($outsideUser)
            ->delete("/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}")
            ->assertForbidden();

        // Guest redirected to login
        auth()->logout();
        $this->get("/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}")
            ->assertRedirect('/login');
    }

    /**
     * 8. Cross-project activity ID manipulation is blocked.
     */
    public function test_cross_project_activity_id_manipulation_is_blocked(): void
    {
        // Project 1
        $leader1 = $this->createVerifiedUser();
        $project1 = $this->createProjectWithLeader($leader1);
        $staff1 = $this->createVerifiedUser();
        $committee1 = $this->createCommitteeWithHead($project1, $staff1);
        $activity1 = $this->createActivity($committee1, $staff1);

        // Project 2
        $leader2 = $this->createVerifiedUser();
        $project2 = $this->createProjectWithLeader($leader2);
        $staff2 = $this->createVerifiedUser();
        $committee2 = $this->createCommitteeWithHead($project2, $staff2);

        // Attempt accessing activity1 with project2 / committee2 route parameters
        $this->actingAs($staff2)
            ->get("/projects/{$project2->id}/committees/{$committee2->id}/activities/{$activity1->id}")
            ->assertNotFound();

        $this->actingAs($staff2)
            ->patch("/projects/{$project2->id}/committees/{$committee2->id}/activities/{$activity1->id}", [
                'title' => 'Manipulated update',
                'status' => Activity::STATUS_IN_PROGRESS,
            ])
            ->assertNotFound();
    }

    // =========================================================================
    // TASKS TESTS (9 to 15)
    // =========================================================================

    /**
     * 9. Authorized Project Staff can create a Task under an Activity in their committee.
     */
    public function test_authorized_project_staff_can_create_task_under_activity_in_their_committee(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $staff = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithHead($project, $staff);
        $activity = $this->createActivity($committee, $staff);

        $member = $this->createVerifiedUser();
        $this->assignProjectRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committee->id);

        $taskData = [
            'title' => 'Print ID badges for participants',
            'description' => 'Use badge template with ITASK barcode.',
            'status' => Task::STATUS_TODO,
            'assigned_to' => $member->id,
            'due_date' => now()->addDays(5)->format('Y-m-d'),
        ];

        $response = $this->actingAs($staff)
            ->post("/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}/tasks", $taskData);

        $response->assertRedirect("/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}");

        $this->assertDatabaseHas('tasks', [
            'activity_id' => $activity->id,
            'assigned_to' => $member->id,
            'title' => 'Print ID badges for participants',
            'status' => Task::STATUS_TODO,
        ]);
    }

    /**
     * 10. Project Staff cannot create a Task under another committee's Activity.
     */
    public function test_project_staff_cannot_create_task_under_another_committees_activity(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $staffA = $this->createVerifiedUser();
        $committeeA = $this->createCommitteeWithHead($project, $staffA);

        $staffB = $this->createVerifiedUser();
        $committeeB = $this->createCommitteeWithHead($project, $staffB);
        $activityB = $this->createActivity($committeeB, $staffB);

        $taskData = [
            'title' => 'Unauthorized Task Creation Attempt',
            'status' => Task::STATUS_TODO,
        ];

        $response = $this->actingAs($staffA)
            ->post("/projects/{$project->id}/committees/{$committeeB->id}/activities/{$activityB->id}/tasks", $taskData);

        $response->assertForbidden();

        $this->assertDatabaseMissing('tasks', [
            'title' => 'Unauthorized Task Creation Attempt',
        ]);
    }

    /**
     * 11. Project Staff can update a Task in their committee.
     */
    public function test_project_staff_can_update_task_in_their_committee(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $staff = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithHead($project, $staff);
        $activity = $this->createActivity($committee, $staff);
        $task = $this->createTask($activity);

        $updateData = [
            'title' => 'Updated Task Title',
            'description' => 'Task description updated by staff.',
            'due_date' => now()->addDays(2)->format('Y-m-d'),
        ];

        $response = $this->actingAs($staff)
            ->patch("/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}/tasks/{$task->id}", $updateData);

        $response->assertRedirect("/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}");

        $this->assertDatabaseHas('tasks', [
            'id' => $task->id,
            'title' => 'Updated Task Title',
            'description' => 'Task description updated by staff.',
        ]);
    }

    /**
     * 12. Project Staff cannot update another committee's Task.
     */
    public function test_project_staff_cannot_update_another_committees_task(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $staffA = $this->createVerifiedUser();
        $committeeA = $this->createCommitteeWithHead($project, $staffA);

        $staffB = $this->createVerifiedUser();
        $committeeB = $this->createCommitteeWithHead($project, $staffB);
        $activityB = $this->createActivity($committeeB, $staffB);
        $taskB = $this->createTask($activityB);

        $response = $this->actingAs($staffA)
            ->patch("/projects/{$project->id}/committees/{$committeeB->id}/activities/{$activityB->id}/tasks/{$taskB->id}", [
                'title' => 'Malicious Task Edit',
                'status' => Task::STATUS_COMPLETED,
            ]);

        $response->assertForbidden();

        $this->assertDatabaseMissing('tasks', [
            'title' => 'Malicious Task Edit',
        ]);
    }

    /**
     * 13. Project Member cannot perform management actions.
     */
    public function test_project_member_cannot_perform_management_actions(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $staff = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithHead($project, $staff);
        $activity = $this->createActivity($committee, $staff);
        $task = $this->createTask($activity);

        $member = $this->createVerifiedUser();
        $this->assignProjectRole($project, $member, ProjectRoleAssignment::ROLE_PROJECT_MEMBER, $committee->id);

        // Member cannot create activity
        $this->actingAs($member)
            ->post("/projects/{$project->id}/committees/{$committee->id}/activities", [
                'title' => 'Member created activity',
                'status' => Activity::STATUS_TODO,
            ])
            ->assertForbidden();

        // Member cannot edit activity
        $this->actingAs($member)
            ->patch("/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}", [
                'title' => 'Member edited activity',
                'status' => Activity::STATUS_IN_PROGRESS,
            ])
            ->assertForbidden();

        // Member cannot delete activity
        $this->actingAs($member)
            ->delete("/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}")
            ->assertForbidden();

        // Member cannot create task
        $this->actingAs($member)
            ->post("/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}/tasks", [
                'title' => 'Member created task',
                'status' => Task::STATUS_TODO,
            ])
            ->assertForbidden();

        // Member cannot update task through management endpoint
        $this->actingAs($member)
            ->patch("/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}/tasks/{$task->id}", [
                'title' => 'Member updated task',
                'status' => Task::STATUS_COMPLETED,
            ])
            ->assertForbidden();

        // Member cannot delete task
        $this->actingAs($member)
            ->delete("/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}/tasks/{$task->id}")
            ->assertForbidden();
    }

    /**
     * 14. Project Leader can view tasks across the project.
     */
    public function test_project_leader_can_view_tasks_across_the_project(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $staff = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithHead($project, $staff);
        $activity = $this->createActivity($committee, $staff);
        $task = $this->createTask($activity);

        $response = $this->actingAs($leader)
            ->get("/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}");

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Activities/Show')
            ->has('activity.tasks', 1)
            ->where('activity.tasks.0.id', (string) $task->id)
        );
    }

    /**
     * 15. Cross-project task ID manipulation is blocked.
     */
    public function test_cross_project_task_id_manipulation_is_blocked(): void
    {
        // Project 1
        $leader1 = $this->createVerifiedUser();
        $project1 = $this->createProjectWithLeader($leader1);
        $staff1 = $this->createVerifiedUser();
        $committee1 = $this->createCommitteeWithHead($project1, $staff1);
        $activity1 = $this->createActivity($committee1, $staff1);
        $task1 = $this->createTask($activity1);

        // Project 2
        $leader2 = $this->createVerifiedUser();
        $project2 = $this->createProjectWithLeader($leader2);
        $staff2 = $this->createVerifiedUser();
        $committee2 = $this->createCommitteeWithHead($project2, $staff2);
        $activity2 = $this->createActivity($committee2, $staff2);

        // Attempting to patch task1 through Project 2 / Committee 2 / Activity 2
        $this->actingAs($staff2)
            ->patch("/projects/{$project2->id}/committees/{$committee2->id}/activities/{$activity2->id}/tasks/{$task1->id}", [
                'title' => 'Manipulated Task Update',
                'status' => Task::STATUS_COMPLETED,
            ])
            ->assertNotFound();

        // Attempting to delete task1 through mismatched hierarchy
        $this->actingAs($staff2)
            ->delete("/projects/{$project2->id}/committees/{$committee2->id}/activities/{$activity2->id}/tasks/{$task1->id}")
            ->assertNotFound();
    }

    // =========================================================================
    // VALIDATION TESTS (16 to 18)
    // =========================================================================

    /**
     * 16. Invalid Activity data is rejected.
     */
    public function test_invalid_activity_data_is_rejected(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $staff = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithHead($project, $staff);

        // Missing title & invalid status & invalid date format
        $response = $this->actingAs($staff)
            ->post("/projects/{$project->id}/committees/{$committee->id}/activities", [
                'title' => '',
                'status' => 'INVALID_STATUS',
                'due_date' => 'not-a-valid-date',
            ]);

        $response->assertSessionHasErrors(['title', 'status', 'due_date']);
    }

    /**
     * 17. Invalid Task data is rejected.
     */
    public function test_invalid_task_data_is_rejected(): void
    {
        $leader = $this->createVerifiedUser();
        $project = $this->createProjectWithLeader($leader);

        $staff = $this->createVerifiedUser();
        $committee = $this->createCommitteeWithHead($project, $staff);
        $activity = $this->createActivity($committee, $staff);

        $outsideUser = $this->createVerifiedUser(); // Not assigned to project

        // Missing title, invalid status, assignee not on project
        $response = $this->actingAs($staff)
            ->post("/projects/{$project->id}/committees/{$committee->id}/activities/{$activity->id}/tasks", [
                'title' => '',
                'status' => 'NON_EXISTENT_STATUS',
                'assigned_to' => $outsideUser->id,
                'due_date' => 'invalid-date',
            ]);

        $response->assertSessionHasErrors(['title', 'status', 'assigned_to', 'due_date']);
    }

    /**
     * 18. Invalid parent relationships are rejected.
     */
    public function test_invalid_parent_relationships_are_rejected(): void
    {
        // Project 1 & Committee 1
        $leader1 = $this->createVerifiedUser();
        $project1 = $this->createProjectWithLeader($leader1);
        $staff1 = $this->createVerifiedUser();
        $committee1 = $this->createCommitteeWithHead($project1, $staff1);
        $activity1 = $this->createActivity($committee1, $staff1);

        // Project 2 & Committee 2
        $leader2 = $this->createVerifiedUser();
        $project2 = $this->createProjectWithLeader($leader2);
        $staff2 = $this->createVerifiedUser();
        $committee2 = $this->createCommitteeWithHead($project2, $staff2);

        // Committee 2 doesn't belong to Project 1
        $this->actingAs($staff1)
            ->post("/projects/{$project1->id}/committees/{$committee2->id}/activities", [
                'title' => 'Orphan test',
                'status' => Activity::STATUS_TODO,
            ])
            ->assertNotFound();

        // Activity 1 doesn't belong to Committee 2
        $this->actingAs($staff2)
            ->post("/projects/{$project2->id}/committees/{$committee2->id}/activities/{$activity1->id}/tasks", [
                'title' => 'Orphan task test',
                'status' => Task::STATUS_TODO,
            ])
            ->assertNotFound();
    }
}
