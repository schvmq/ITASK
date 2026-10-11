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

class RoleNavigationAndChecklistAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    private User $leader;

    private User $staff;

    private User $member;

    private User $outsider;

    private Project $project;

    private Committee $committee;

    private Activity $activity;

    private Task $task;

    private Task $unassignedTask;

    protected function setUp(): void
    {
        parent::setUp();

        $this->leader = User::factory()->create([
            'name' => 'Project Leader',
            'email' => 'leader@example.com',
            'email_verified_at' => now(),
        ]);

        $this->staff = User::factory()->create([
            'name' => 'Project Staff',
            'email' => 'staff@example.com',
            'email_verified_at' => now(),
        ]);

        $this->member = User::factory()->create([
            'name' => 'Project Member',
            'email' => 'member@example.com',
            'email_verified_at' => now(),
        ]);

        $this->outsider = User::factory()->create([
            'name' => 'Outsider User',
            'email' => 'outsider@example.com',
            'email_verified_at' => now(),
        ]);

        $this->project = Project::create([
            'title' => 'Navigation & Checklist System',
            'description' => 'Test project for roles and checklists',
            'status' => 'Active',
            'created_by' => $this->leader->id,
            'start_date' => now()->subDays(2),
            'end_date' => now()->addDays(10),
        ]);

        $this->committee = Committee::create([
            'project_id' => $this->project->id,
            'name' => 'Engineering Committee',
            'description' => 'Handles engineering activities',
        ]);

        ProjectRoleAssignment::create([
            'project_id' => $this->project->id,
            'user_id' => $this->leader->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_LEADER,
            'committee_id' => null,
        ]);

        ProjectRoleAssignment::create([
            'project_id' => $this->project->id,
            'user_id' => $this->staff->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_STAFF,
            'committee_id' => $this->committee->id,
        ]);

        ProjectRoleAssignment::create([
            'project_id' => $this->project->id,
            'user_id' => $this->member->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_MEMBER,
            'committee_id' => $this->committee->id,
        ]);

        $this->activity = Activity::create([
            'project_id' => $this->project->id,
            'committee_id' => $this->committee->id,
            'title' => 'Sprint 1 Tasks',
            'status' => 'In Progress',
            'created_by' => $this->staff->id,
        ]);

        $this->task = Task::create([
            'activity_id' => $this->activity->id,
            'title' => 'Assigned Member Task',
            'status' => Task::STATUS_TODO,
            'assigned_to' => $this->member->id,
            'requires_review' => false,
            'due_date' => now()->addDays(3),
        ]);

        $this->unassignedTask = Task::create([
            'activity_id' => $this->activity->id,
            'title' => 'Unassigned Committee Task',
            'status' => Task::STATUS_TODO,
            'assigned_to' => null,
            'requires_review' => false,
            'due_date' => now()->addDays(5),
        ]);
    }

    /**
     * 1. Test Inertia globally shares primaryRole and userRoles.
     */
    public function test_global_inertia_shares_primary_role_and_user_roles(): void
    {
        // Leader
        $response = $this->actingAs($this->leader)->get('/dashboard');
        $response->assertStatus(200);
        $response->assertInertia(fn (Assert $page) => $page
            ->where('primaryRole', 'Project Leader')
            ->has('userRoles')
        );

        // Staff
        $response = $this->actingAs($this->staff)->get('/dashboard');
        $response->assertStatus(200);
        $response->assertInertia(fn (Assert $page) => $page
            ->where('primaryRole', 'Project Staff')
        );

        // Member
        $response = $this->actingAs($this->member)->get('/dashboard');
        $response->assertStatus(200);
        $response->assertInertia(fn (Assert $page) => $page
            ->where('primaryRole', 'Project Member')
        );
    }

    /**
     * 2. Checklist: Project Leader can create, update, and toggle checklist items (no 403).
     */
    public function test_project_leader_can_manage_checklist_items_without_403(): void
    {
        // Create checklist item
        $response = $this->actingAs($this->leader)->post(
            "/projects/{$this->project->id}/committees/{$this->committee->id}/activities/{$this->activity->id}/tasks/{$this->task->id}/checklist",
            [
                'content' => 'Review technical specifications',
                'is_completed' => false,
                'order' => 0,
            ]
        );
        $response->assertRedirect();
        $this->assertDatabaseHas('checklist_items', [
            'task_id' => $this->task->id,
            'content' => 'Review technical specifications',
        ]);

        $item = ChecklistItem::where('task_id', $this->task->id)->firstOrFail();

        // Update / Toggle checklist item
        $patchResponse = $this->actingAs($this->leader)->patch(
            "/projects/{$this->project->id}/committees/{$this->committee->id}/activities/{$this->activity->id}/tasks/{$this->task->id}/checklist/{$item->id}",
            [
                'is_completed' => true,
            ]
        );
        $patchResponse->assertRedirect();
        $this->assertDatabaseHas('checklist_items', [
            'id' => $item->id,
            'is_completed' => true,
        ]);
    }

    /**
     * 3. Checklist: Project Staff can create, update, and toggle checklist items (no 403).
     */
    public function test_project_staff_can_manage_checklist_items_without_403(): void
    {
        $response = $this->actingAs($this->staff)->post(
            "/projects/{$this->project->id}/committees/{$this->committee->id}/activities/{$this->activity->id}/tasks/{$this->task->id}/checklist",
            [
                'content' => 'Staff verification step',
                'is_completed' => false,
                'order' => 1,
            ]
        );
        $response->assertRedirect();
        $this->assertDatabaseHas('checklist_items', [
            'task_id' => $this->task->id,
            'content' => 'Staff verification step',
        ]);

        $item = ChecklistItem::where('task_id', $this->task->id)->where('content', 'Staff verification step')->firstOrFail();

        $patchResponse = $this->actingAs($this->staff)->patch(
            "/projects/{$this->project->id}/committees/{$this->committee->id}/activities/{$this->activity->id}/tasks/{$this->task->id}/checklist/{$item->id}",
            [
                'is_completed' => true,
            ]
        );
        $patchResponse->assertRedirect();
        $this->assertDatabaseHas('checklist_items', [
            'id' => $item->id,
            'is_completed' => true,
        ]);
    }

    /**
     * 4. Checklist: Assigned Project Member can toggle checklist items (no 403).
     */
    public function test_assigned_member_can_manage_checklist_items_without_403(): void
    {
        $item = ChecklistItem::create([
            'task_id' => $this->task->id,
            'content' => 'Implement React component',
            'is_completed' => false,
            'order' => 0,
        ]);

        $response = $this->actingAs($this->member)->patch(
            "/projects/{$this->project->id}/committees/{$this->committee->id}/activities/{$this->activity->id}/tasks/{$this->task->id}/checklist/{$item->id}",
            [
                'is_completed' => true,
            ]
        );
        $response->assertRedirect();
        $this->assertDatabaseHas('checklist_items', [
            'id' => $item->id,
            'is_completed' => true,
        ]);
    }

    /**
     * 5. Checklist: Committee member can manage checklist items on an unassigned task.
     */
    public function test_committee_member_can_manage_checklist_on_unassigned_task(): void
    {
        $response = $this->actingAs($this->member)->post(
            "/projects/{$this->project->id}/committees/{$this->committee->id}/activities/{$this->activity->id}/tasks/{$this->unassignedTask->id}/checklist",
            [
                'content' => 'Initial unassigned checklist item',
                'is_completed' => false,
                'order' => 0,
            ]
        );
        $response->assertRedirect();
        $this->assertDatabaseHas('checklist_items', [
            'task_id' => $this->unassignedTask->id,
            'content' => 'Initial unassigned checklist item',
        ]);
    }

    /**
     * 6. Checklist: Outsider is denied with 403.
     */
    public function test_outsider_is_denied_with_403_on_checklist(): void
    {
        $response = $this->actingAs($this->outsider)->post(
            "/projects/{$this->project->id}/committees/{$this->committee->id}/activities/{$this->activity->id}/tasks/{$this->task->id}/checklist",
            [
                'content' => 'Malicious checklist item',
                'is_completed' => false,
                'order' => 0,
            ]
        );
        $response->assertStatus(403);
    }

    /**
     * 7. MyTasks: Returns strictly tasks assigned to the logged-in user across all projects.
     */
    public function test_my_tasks_provides_accurate_is_mine_flag(): void
    {
        // Create a task assigned to leader
        Task::create([
            'activity_id' => $this->activity->id,
            'title' => 'Leader Personal Deliverable',
            'status' => Task::STATUS_TODO,
            'assigned_to' => $this->leader->id,
            'requires_review' => false,
            'due_date' => now()->addDays(2),
        ]);

        $response = $this->actingAs($this->leader)->get('/my-tasks');
        $response->assertStatus(200);
        $response->assertInertia(function (Assert $page) {
            $page->component('MyTasks/Index')
                ->has('tasks', 1)
                ->where('tasks.0.is_mine', true);
        });

        $memberResponse = $this->actingAs($this->member)->get('/my-tasks');
        $memberResponse->assertStatus(200);
        $memberResponse->assertInertia(function (Assert $page) {
            $page->component('MyTasks/Index')
                ->has('tasks', 1)
                ->where('tasks.0.is_mine', true);
        });
    }

    /**
     * 8. Project Creation Authorization:
     * - Leader can create projects.
     * - Member and Staff are blocked with 403 Forbidden.
     */
    public function test_project_creation_authorization_by_role(): void
    {
        // Member attempt -> 403
        $memberResponse = $this->actingAs($this->member)->post('/projects', [
            'title' => 'Member Project Attempt',
            'description' => 'Should be forbidden',
            'start_date' => now()->format('Y-m-d'),
            'end_date' => now()->addMonth()->format('Y-m-d'),
        ]);
        $memberResponse->assertStatus(403);

        // Staff attempt -> 403
        $staffResponse = $this->actingAs($this->staff)->post('/projects', [
            'title' => 'Staff Project Attempt',
            'description' => 'Should be forbidden',
            'start_date' => now()->format('Y-m-d'),
            'end_date' => now()->addMonth()->format('Y-m-d'),
        ]);
        $staffResponse->assertStatus(403);

        // Leader attempt -> Success (redirect to project show page)
        $file = \Illuminate\Http\UploadedFile::fake()->create('approval.pdf', 100, 'application/pdf');
        $leaderResponse = $this->actingAs($this->leader)->post('/projects', [
            'title' => 'Leader New Project',
            'description' => 'Authorized project creation',
            'start_date' => now()->format('Y-m-d'),
            'end_date' => now()->addMonth()->format('Y-m-d'),
            'approval_document' => $file,
        ]);
        $leaderResponse->assertRedirect();
        $this->assertDatabaseHas('projects', [
            'title' => 'Leader New Project',
            'created_by' => $this->leader->id,
        ]);
    }

    /**
     * 9. The 7 Global Pages are accessible to all three roles (200 OK).
     */
    public function test_all_seven_global_pages_accessible_to_all_three_roles(): void
    {
        $pages = [
            '/dashboard',
            '/my-tasks',
            '/projects',
            '/timeline',
            '/calendar',
            '/messages',
            '/notifications',
        ];

        foreach ([$this->leader, $this->staff, $this->member] as $user) {
            foreach ($pages as $url) {
                $response = $this->actingAs($user)->get($url);
                $this->assertEquals(
                    200,
                    $response->status(),
                    "User {$user->name} failed to access {$url} with status {$response->status()}"
                );
            }
        }
    }
}
