<?php

namespace Tests\Feature;

use App\Models\Activity;
use App\Models\Committee;
use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class CalendarTest extends TestCase
{
    use RefreshDatabase;

    protected function createVerifiedUser(array $attributes = []): User
    {
        $user = User::create(array_merge([
            'name'     => 'Verified User ' . uniqid(),
            'email'    => 'user_' . uniqid() . '@carsu.edu.ph',
            'password' => bcrypt('SecurePass123!'),
        ], $attributes));

        $user->forceFill(['email_verified_at' => now()])->save();

        return $user;
    }

    public function test_guest_is_redirected_from_calendar(): void
    {
        $response = $this->get(route('calendar.index'));

        $response->assertRedirect(route('login'));
    }

    public function test_unverified_user_is_redirected_from_calendar(): void
    {
        $user = User::create([
            'name'     => 'Unverified User',
            'email'    => 'unverified@carsu.edu.ph',
            'password' => bcrypt('SecurePass123!'),
        ]);

        $response = $this->actingAs($user)->get(route('calendar.index'));

        $response->assertRedirect(route('verification.notice'));
    }

    public function test_verified_user_can_access_calendar(): void
    {
        $user = $this->createVerifiedUser();

        $response = $this->actingAs($user)->get(route('calendar.index'));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Calendar/Index')
            ->has('events')
        );
    }

    public function test_calendar_loads_authorized_project_activity_and_task_dates(): void
    {
        $leader = $this->createVerifiedUser(['name' => 'Leader User']);
        $member = $this->createVerifiedUser(['name' => 'Member User']);

        // Project created by leader
        $project = Project::create([
            'created_by'  => $leader->id,
            'title'       => 'Annual ICT Congress 2026',
            'description' => 'Test project',
            'status'      => Project::STATUS_PLANNING,
            'start_date'  => '2026-10-01',
            'end_date'    => '2026-10-31',
        ]);

        ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'user_id'    => $leader->id,
            'role'       => ProjectRoleAssignment::ROLE_PROJECT_LEADER,
        ]);

        $committee = Committee::create([
            'project_id'  => $project->id,
            'name'        => 'Logistics Committee',
            'description' => 'Handles logistics',
        ]);

        $activity = Activity::create([
            'project_id'   => $project->id,
            'committee_id' => $committee->id,
            'title'        => 'Venue Preparation',
            'description'  => 'Prepare venue',
            'status'       => Activity::STATUS_IN_PROGRESS,
            'start_date'   => '2026-10-05',
            'due_date'     => '2026-10-10',
            'created_by'   => $leader->id,
        ]);

        $task = Task::create([
            'activity_id' => $activity->id,
            'title'       => 'Reserve Main Auditorium',
            'description' => 'Reserve the hall',
            'status'      => Task::STATUS_TODO,
            'due_date'    => '2026-10-08',
            'created_by'  => $leader->id,
            'assigned_to' => $member->id,
        ]);

        // Leader sees project start/end, activity start/due, and task due
        $response = $this->actingAs($leader)->get(route('calendar.index'));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Calendar/Index')
            ->has('events', 5) // project start, project deadline, activity start, activity due, task due
        );

        // Member who only has assignment sees the task due
        $responseMember = $this->actingAs($member)->get(route('calendar.index'));
        $responseMember->assertOk();
        $responseMember->assertInertia(fn (Assert $page) => $page
            ->component('Calendar/Index')
            ->where('events', function ($events) use ($task) {
                return collect($events)->contains('title', $task->title);
            })
        );
    }

    public function test_calendar_does_not_leak_unauthorized_project_events(): void
    {
        $userA = $this->createVerifiedUser();
        $userB = $this->createVerifiedUser();

        $projectA = Project::create([
            'created_by'  => $userA->id,
            'title'       => 'Private Project Alpha',
            'description' => 'Secret',
            'status'      => Project::STATUS_PLANNING,
            'start_date'  => '2026-11-01',
            'end_date'    => '2026-11-15',
        ]);

        ProjectRoleAssignment::create([
            'project_id' => $projectA->id,
            'user_id'    => $userA->id,
            'role'       => ProjectRoleAssignment::ROLE_PROJECT_LEADER,
        ]);

        $response = $this->actingAs($userB)->get(route('calendar.index'));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Calendar/Index')
            ->where('events', function ($events) use ($projectA) {
                return !collect($events)->contains('title', $projectA->title);
            })
        );
    }
}
