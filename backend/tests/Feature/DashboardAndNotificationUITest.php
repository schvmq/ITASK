<?php

namespace Tests\Feature;

use App\Models\Activity;
use App\Models\Committee;
use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Models\Task;
use App\Models\User;
use App\Notifications\TaskAssignedNotification;
use App\Notifications\TaskReviewedNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class DashboardAndNotificationUITest extends TestCase
{
    use RefreshDatabase;

    private User $leader;
    private User $staff;
    private User $member1;
    private User $member2;
    private User $unrelatedUser;
    private Project $project;
    private Committee $committee;
    private Activity $activity;

    protected function setUp(): void
    {
        parent::setUp();

        $this->leader = User::factory()->create([
            'name' => 'ITASK Test Leader',
            'email' => 'leader.itask@carsu.edu.ph',
            'email_verified_at' => now(),
        ]);

        $this->staff = User::factory()->create([
            'name' => 'ITASK Test Staff',
            'email' => 'staff.itask@carsu.edu.ph',
            'email_verified_at' => now(),
        ]);

        $this->member1 = User::factory()->create([
            'name' => 'ITASK Test Member 01',
            'email' => 'member01.itask@carsu.edu.ph',
            'email_verified_at' => now(),
        ]);

        $this->member2 = User::factory()->create([
            'name' => 'ITASK Test Member 02',
            'email' => 'member02.itask@carsu.edu.ph',
            'email_verified_at' => now(),
        ]);

        $this->unrelatedUser = User::factory()->create([
            'name' => 'Outsider User',
            'email' => 'outsider@carsu.edu.ph',
            'email_verified_at' => now(),
        ]);

        // Main Project
        $this->project = Project::create([
            'title' => 'ITASK Test Project',
            'description' => 'Main ITASK test workspace',
            'status' => Project::STATUS_ACTIVE,
            'start_date' => '2026-09-01',
            'end_date' => '2026-12-31',
            'created_by' => $this->leader->id,
        ]);

        // Role Assignments
        ProjectRoleAssignment::create([
            'project_id' => $this->project->id,
            'user_id' => $this->leader->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_LEADER,
            'committee_id' => null,
        ]);

        $this->committee = Committee::create([
            'project_id' => $this->project->id,
            'name' => 'Test Committee',
            'description' => 'Primary operations committee',
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
            'project_id' => $this->project->id,
            'committee_id' => $this->committee->id,
            'created_by' => $this->staff->id,
            'title' => 'Core Operational Deliverables',
            'status' => Activity::STATUS_IN_PROGRESS,
            'start_date' => '2026-09-15',
            'due_date' => '2026-10-15',
        ]);
    }

    // =========================================================================
    // 1. NOTIFICATIONS UI TESTS
    // =========================================================================

    public function test_authenticated_user_sees_own_notifications_and_unread_count(): void
    {
        $task = Task::create([
            'activity_id' => $this->activity->id,
            'title' => 'Setup Audio Rig',
            'status' => Task::STATUS_IN_PROGRESS,
            'assigned_to' => $this->member1->id,
            'requires_review' => false,
            'due_date' => '2026-10-05',
        ]);

        // Send notification to member 1
        $this->member1->notify(new TaskAssignedNotification(
            $task,
            $this->activity,
            $this->committee,
            $this->project,
            $this->staff
        ));

        // Send separate notification to member 2
        $this->member2->notify(new TaskAssignedNotification(
            $task,
            $this->activity,
            $this->committee,
            $this->project,
            $this->staff
        ));

        $response = $this->actingAs($this->member1)->get('/notifications');

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Notifications/Index')
            ->where('unreadCount', 1)
            ->has('notifications.data', 1)
            ->where('notifications.data.0.data.title', 'Task Assigned')
            ->where('notifications.data.0.data.task.title', 'Setup Audio Rig')
        );
    }

    public function test_marking_notification_as_read_persists(): void
    {
        $task = Task::create([
            'activity_id' => $this->activity->id,
            'title' => 'Lighting Grid Setup',
            'status' => Task::STATUS_IN_PROGRESS,
            'assigned_to' => $this->member1->id,
            'requires_review' => false,
            'due_date' => '2026-10-05',
        ]);

        $this->member1->notify(new TaskAssignedNotification(
            $task,
            $this->activity,
            $this->committee,
            $this->project,
            $this->staff
        ));

        $notification = $this->member1->notifications()->first();
        $this->assertNull($notification->read_at);

        $response = $this->actingAs($this->member1)->post("/notifications/{$notification->id}/read");

        $response->assertRedirect();
        $this->assertNotNull($notification->fresh()->read_at);
        $this->assertSame(0, $this->member1->unreadNotifications()->count());
    }

    public function test_user_cannot_mark_another_users_notification_as_read(): void
    {
        $task = Task::create([
            'activity_id' => $this->activity->id,
            'title' => 'Private Task',
            'status' => Task::STATUS_IN_PROGRESS,
            'assigned_to' => $this->member1->id,
            'requires_review' => false,
            'due_date' => '2026-10-05',
        ]);

        $this->member1->notify(new TaskAssignedNotification(
            $task,
            $this->activity,
            $this->committee,
            $this->project,
            $this->staff
        ));

        $notification = $this->member1->notifications()->first();

        // Member 2 tries to mark Member 1's notification
        $response = $this->actingAs($this->member2)->post("/notifications/{$notification->id}/read");

        $response->assertStatus(404);
        $this->assertNull($notification->fresh()->read_at);
    }

    public function test_mark_all_notifications_as_read(): void
    {
        $task1 = Task::create([
            'activity_id' => $this->activity->id,
            'title' => 'Task A',
            'status' => Task::STATUS_IN_PROGRESS,
            'assigned_to' => $this->member1->id,
            'requires_review' => false,
        ]);
        $task2 = Task::create([
            'activity_id' => $this->activity->id,
            'title' => 'Task B',
            'status' => Task::STATUS_IN_PROGRESS,
            'assigned_to' => $this->member1->id,
            'requires_review' => false,
        ]);

        $this->member1->notify(new TaskAssignedNotification($task1, $this->activity, $this->committee, $this->project, $this->staff));
        $this->member1->notify(new TaskAssignedNotification($task2, $this->activity, $this->committee, $this->project, $this->staff));

        $this->assertSame(2, $this->member1->unreadNotifications()->count());

        $response = $this->actingAs($this->member1)->post('/notifications/mark-all-read');

        $response->assertRedirect();
        $this->assertSame(0, $this->member1->unreadNotifications()->count());
    }

    public function test_notification_navigation_data_is_correct(): void
    {
        $task = Task::create([
            'activity_id' => $this->activity->id,
            'title' => 'Routing Check Task',
            'status' => Task::STATUS_IN_PROGRESS,
            'assigned_to' => $this->member1->id,
            'requires_review' => false,
        ]);

        $this->member1->notify(new TaskAssignedNotification($task, $this->activity, $this->committee, $this->project, $this->staff));

        $notification = $this->member1->notifications()->first();
        $expectedUrl = route('projects.committees.activities.show', [
            'project' => $this->project->id,
            'committee' => $this->committee->id,
            'activity' => $this->activity->id,
        ]);

        $this->assertSame($expectedUrl, $notification->data['action_url']);
    }

    // =========================================================================
    // 2. DASHBOARD ROLE-SCOPED TESTS
    // =========================================================================

    public function test_project_leader_dashboard_sees_led_projects_and_committees_and_not_unrelated_projects(): void
    {
        // Unrelated project
        $otherProject = Project::create([
            'title' => 'Secret Other Project',
            'status' => Project::STATUS_ACTIVE,
            'created_by' => $this->unrelatedUser->id,
        ]);

        $response = $this->actingAs($this->leader)->get('/dashboard');

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Welcome')
            ->where('primaryRole', ProjectRoleAssignment::ROLE_PROJECT_LEADER)
            ->has('projects', 1)
            ->where('projects.0.id', (string) $this->project->id)
            ->where('projects.0.title', 'ITASK Test Project')
            ->has('committees', 1)
            ->where('committees.0.name', 'Test Committee')
        );
    }

    public function test_project_staff_dashboard_sees_assigned_committee_and_review_items(): void
    {
        // Create an Under Review task in this committee
        $reviewTask = Task::create([
            'activity_id' => $this->activity->id,
            'title' => 'Under Review Stage Cue Sheet',
            'status' => Task::STATUS_UNDER_REVIEW,
            'assigned_to' => $this->member1->id,
            'requires_review' => true,
            'due_date' => '2026-10-10',
        ]);

        $response = $this->actingAs($this->staff)->get('/dashboard');

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Welcome')
            ->where('primaryRole', ProjectRoleAssignment::ROLE_PROJECT_STAFF)
            ->has('committees', 1)
            ->where('committees.0.name', 'Test Committee')
            ->has('pendingReviews', 1)
            ->where('pendingReviews.0.id', (string) $reviewTask->id)
            ->where('pendingReviews.0.title', 'Under Review Stage Cue Sheet')
        );
    }

    public function test_project_member_dashboard_sees_assigned_tasks_and_does_not_see_other_members_tasks(): void
    {
        // Member 1 task
        $task1 = Task::create([
            'activity_id' => $this->activity->id,
            'title' => 'Member 01 Specific Task',
            'status' => Task::STATUS_IN_PROGRESS,
            'assigned_to' => $this->member1->id,
            'requires_review' => false,
            'due_date' => '2026-10-10',
        ]);

        // Member 2 task
        $task2 = Task::create([
            'activity_id' => $this->activity->id,
            'title' => 'Member 02 Secret Task',
            'status' => Task::STATUS_IN_PROGRESS,
            'assigned_to' => $this->member2->id,
            'requires_review' => false,
            'due_date' => '2026-10-10',
        ]);

        $response = $this->actingAs($this->member1)->get('/dashboard');

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Welcome')
            ->where('primaryRole', ProjectRoleAssignment::ROLE_PROJECT_MEMBER)
            ->has('assignedTasks', 1)
            ->where('assignedTasks.0.id', (string) $task1->id)
            ->where('assignedTasks.0.title', 'Member 01 Specific Task')
        );
    }

    public function test_empty_dashboard_states_for_new_unassigned_user(): void
    {
        $freshUser = User::factory()->create([
            'name' => 'Fresh User',
            'email' => 'fresh@carsu.edu.ph',
            'email_verified_at' => now(),
        ]);

        $response = $this->actingAs($freshUser)->get('/dashboard');

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Welcome')
            ->where('primaryRole', ProjectRoleAssignment::ROLE_PROJECT_MEMBER)
            ->has('projects', 0)
            ->has('committees', 0)
            ->has('assignedTasks', 0)
            ->has('pendingReviews', 0)
            ->where('stats.activeProjectsCount', 0)
            ->where('stats.assignedTasksCount', 0)
        );
    }

    public function test_all_five_development_accounts_dashboard_experience(): void
    {
        // Run DevTestDataSeeder
        $this->seed(\Database\Seeders\DevTestDataSeeder::class);

        $leader = User::where('email', 'leader.itask@carsu.edu.ph')->firstOrFail();
        $staff = User::where('email', 'staff.itask@carsu.edu.ph')->firstOrFail();
        $member01 = User::where('email', 'member01.itask@carsu.edu.ph')->firstOrFail();
        $member02 = User::where('email', 'member02.itask@carsu.edu.ph')->firstOrFail();
        $member03 = User::where('email', 'member03.itask@carsu.edu.ph')->firstOrFail();

        // 1. Leader
        $resLeader = $this->actingAs($leader)->get('/dashboard');
        $resLeader->assertOk();
        $resLeader->assertInertia(fn (Assert $page) => $page
            ->component('Welcome')
            ->where('primaryRole', ProjectRoleAssignment::ROLE_PROJECT_LEADER)
            ->where('projects.0.title', 'ITASK Test Project')
            ->where('committees.0.name', 'Test Committee')
        );

        // 2. Staff
        $resStaff = $this->actingAs($staff)->get('/dashboard');
        $resStaff->assertOk();
        $resStaff->assertInertia(fn (Assert $page) => $page
            ->component('Welcome')
            ->where('primaryRole', ProjectRoleAssignment::ROLE_PROJECT_STAFF)
            ->where('committees.0.name', 'Test Committee')
            ->has('pendingReviews')
        );

        // 3. Member 01
        $resMember01 = $this->actingAs($member01)->get('/dashboard');
        $resMember01->assertOk();
        $resMember01->assertInertia(fn (Assert $page) => $page
            ->component('Welcome')
            ->where('primaryRole', ProjectRoleAssignment::ROLE_PROJECT_MEMBER)
            ->has('assignedTasks')
        );

        // 4. Member 02 (has returned task in seeder)
        $resMember02 = $this->actingAs($member02)->get('/dashboard');
        $resMember02->assertOk();
        $resMember02->assertInertia(fn (Assert $page) => $page
            ->component('Welcome')
            ->where('primaryRole', ProjectRoleAssignment::ROLE_PROJECT_MEMBER)
            ->has('assignedTasks')
        );

        // 5. Member 03
        $resMember03 = $this->actingAs($member03)->get('/dashboard');
        $resMember03->assertOk();
        $resMember03->assertInertia(fn (Assert $page) => $page
            ->component('Welcome')
            ->where('primaryRole', ProjectRoleAssignment::ROLE_PROJECT_MEMBER)
            ->has('assignedTasks')
        );
    }
}
