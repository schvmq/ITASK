<?php

namespace Tests\Feature;

use App\Models\Activity;
use App\Models\Committee;
use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class FrontendRedesignWorkflowTest extends TestCase
{
    use RefreshDatabase;

    private User $leader;
    private User $staff;
    private User $member;
    private User $newUser;
    private Project $project;
    private Committee $committee;
    private Activity $activity;
    private Task $task;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');

        $this->leader = User::factory()->create([
            'name' => 'Project Leader User',
            'email' => 'leader@carsu.edu.ph',
            'email_verified_at' => now(),
        ]);

        $this->staff = User::factory()->create([
            'name' => 'Project Staff User',
            'email' => 'staff@carsu.edu.ph',
            'email_verified_at' => now(),
        ]);

        $this->member = User::factory()->create([
            'name' => 'Project Member User',
            'email' => 'member@carsu.edu.ph',
            'email_verified_at' => now(),
        ]);

        $this->newUser = User::factory()->create([
            'name' => 'Fresh Student User',
            'email' => 'fresh@carsu.edu.ph',
            'email_verified_at' => now(),
        ]);

        $this->project = Project::create([
            'title' => 'Senior Capstone Project',
            'description' => 'Capstone project testing suite',
            'status' => 'Active',
            'created_by' => $this->leader->id,
            'start_date' => now()->subDays(5),
            'end_date' => now()->addDays(20),
        ]);

        $this->committee = Committee::create([
            'project_id' => $this->project->id,
            'name' => 'Development Committee',
            'description' => 'Development committee workspace',
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
            'title' => 'Sprint 1 Development',
            'status' => 'In Progress',
            'created_by' => $this->staff->id,
        ]);

        $this->task = Task::create([
            'activity_id' => $this->activity->id,
            'title' => 'Frontend Redesign Implementation',
            'status' => Task::STATUS_TODO,
            'assigned_to' => $this->member->id,
            'requires_review' => false,
            'due_date' => now()->addDays(2),
        ]);
    }

    /**
     * 1. Public Landing & Authentication Redirects
     */
    public function test_landing_redirect_contract(): void
    {
        $guestResponse = $this->get('/');
        $guestResponse->assertRedirect('/login');

        $authResponse = $this->actingAs($this->member)->get('/dashboard');
        $authResponse->assertStatus(200);
        $authResponse->assertInertia(fn (Assert $page) => $page->component('Welcome'));
    }

    /**
     * 2. Onboarding Visibility for Fresh User vs Existing User
     */
    public function test_onboarding_visibility_when_zero_projects(): void
    {
        $response = $this->actingAs($this->newUser)->get('/dashboard');
        $response->assertStatus(200);
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Welcome')
            ->where('projects', [])
        );
    }

    public function test_onboarding_hidden_when_user_has_active_projects(): void
    {
        $response = $this->actingAs($this->leader)->get('/dashboard');
        $response->assertStatus(200);
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Welcome')
            ->has('projects', 1)
        );
    }

    /**
     * 3. Key Flow: Create Project
     */
    public function test_key_flow_create_project(): void
    {
        $file = UploadedFile::fake()->create('dean_approval.pdf', 200, 'application/pdf');

        $response = $this->actingAs($this->leader)->post('/projects', [
            'title' => 'New Automated Test Project',
            'description' => 'Academic project created by test',
            'start_date' => now()->format('Y-m-d'),
            'end_date' => now()->addDays(30)->format('Y-m-d'),
            'approval_document' => $file,
        ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('projects', [
            'title' => 'New Automated Test Project',
            'created_by' => $this->leader->id,
        ]);
    }

    /**
     * 4. Key Flow: Create Task
     */
    public function test_key_flow_create_task(): void
    {
        $response = $this->actingAs($this->staff)->post(
            "/projects/{$this->project->id}/committees/{$this->committee->id}/activities/{$this->activity->id}/tasks",
            [
                'title' => 'Newly Created Workflow Task',
                'description' => 'Testing automated task creation',
                'assigned_to' => $this->member->id,
                'due_date' => now()->addDays(4)->format('Y-m-d'),
                'requires_review' => false,
            ]
        );

        $response->assertRedirect();
        $this->assertDatabaseHas('tasks', [
            'title' => 'Newly Created Workflow Task',
            'assigned_to' => $this->member->id,
        ]);
    }

    /**
     * 5. Key Flow: Inline Task Completion (Status Update)
     */
    public function test_key_flow_complete_task_inline(): void
    {
        $response = $this->actingAs($this->member)->patch(
            "/projects/{$this->project->id}/committees/{$this->committee->id}/activities/{$this->activity->id}/tasks/{$this->task->id}",
            [
                'status' => Task::STATUS_COMPLETED,
            ]
        );

        $response->assertRedirect();
        $this->assertDatabaseHas('tasks', [
            'id' => $this->task->id,
            'status' => Task::STATUS_COMPLETED,
        ]);
    }

    /**
     * 6. My Tasks Contract & Deadlines Grouping
     */
    public function test_my_tasks_endpoint_contract(): void
    {
        $response = $this->actingAs($this->member)->get('/my-tasks');
        $response->assertStatus(200);
        $response->assertInertia(fn (Assert $page) => $page
            ->component('MyTasks/Index')
            ->has('tasks')
            ->has('stats')
        );
    }

    /**
     * 7. Notifications Contract & Server Pagination
     */
    public function test_notifications_endpoint_server_pagination_contract(): void
    {
        $response = $this->actingAs($this->member)->get('/notifications');
        $response->assertStatus(200);
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Notifications/Index')
            ->has('notifications.data')
            ->has('notifications.current_page')
            ->has('notifications.last_page')
            ->has('notifications.total')
        );
    }

    /**
     * 8. Projects Contract & Client Pagination
     */
    public function test_projects_endpoint_contract(): void
    {
        $response = $this->actingAs($this->member)->get('/projects');
        $response->assertStatus(200);
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Projects/Index')
            ->has('projects')
        );
    }
}
