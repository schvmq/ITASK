<?php

namespace Tests\Feature\Api;

use App\Models\Activity;
use App\Models\Chat;
use App\Models\Committee;
use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Models\Task;
use App\Models\User;
use App\Notifications\TaskAssignedNotification;
use App\Services\Authorization\RoleRegistry;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApiWorkspaceTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_user_can_retrieve_workspace_dashboard(): void
    {
        $leader = User::factory()->create();
        $project = Project::create([
            'title' => 'Dashboard Workspace Project',
            'created_by' => $leader->id,
            'status' => Project::STATUS_ACTIVE,
        ]);
        ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'user_id' => $leader->id,
            'role' => RoleRegistry::ROLE_PROJECT_LEADER,
        ]);

        $response = $this->actingAs($leader)->getJson('/api/dashboard');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'primary_role',
                'stats' => [
                    'activeProjectsCount',
                    'assignedTasksCount',
                    'completedTasksCount',
                    'pendingReviewsCount',
                    'returnedTasksCount',
                    'overdueTasksCount',
                    'approachingTasksCount',
                ],
                'projects',
                'committees',
                'assigned_tasks',
                'pending_reviews',
                'announcement',
            ])
            ->assertJsonPath('primary_role', RoleRegistry::ROLE_PROJECT_LEADER);
    }

    public function test_user_can_retrieve_my_tasks(): void
    {
        $leader = User::factory()->create();
        $member = User::factory()->create();

        $project = Project::create([
            'title' => 'My Tasks Project',
            'created_by' => $leader->id,
            'status' => Project::STATUS_ACTIVE,
        ]);
        $committee = $project->committees()->create(['name' => 'Tasks Committee']);
        $activity = $committee->activities()->create([
            'project_id' => $project->id,
            'created_by' => $leader->id,
            'title' => 'Tasks Activity',
            'status' => Activity::STATUS_IN_PROGRESS,
            'start_date' => '2026-10-01',
            'due_date' => '2026-10-20',
        ]);
        $task = $activity->tasks()->create([
            'title' => 'Assigned Individual Task',
            'status' => Task::STATUS_IN_PROGRESS,
            'assigned_to' => $member->id,
            'due_date' => '2026-10-18',
        ]);

        ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'committee_id' => $committee->id,
            'user_id' => $member->id,
            'role' => RoleRegistry::ROLE_PROJECT_MEMBER,
        ]);

        $response = $this->actingAs($member)->getJson('/api/my-tasks');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'tasks',
                'role_context',
            ])
            ->assertJsonPath('tasks.0.id', (string) $task->id)
            ->assertJsonPath('tasks.0.is_mine', true);
    }

    public function test_calendar_events_scoped_to_authorized_user(): void
    {
        $leader = User::factory()->create();
        $project = Project::create([
            'title' => 'Calendar Project',
            'created_by' => $leader->id,
            'status' => Project::STATUS_ACTIVE,
            'start_date' => '2026-10-01',
            'end_date' => '2026-11-01',
        ]);
        ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'user_id' => $leader->id,
            'role' => RoleRegistry::ROLE_PROJECT_LEADER,
        ]);

        $response = $this->actingAs($leader)->getJson('/api/calendar');

        $response->assertStatus(200)
            ->assertJsonStructure(['events']);

        $events = collect($response->json('events'));
        $this->assertTrue($events->contains(fn ($e) => $e['type'] === 'project_start'));
        $this->assertTrue($events->contains(fn ($e) => $e['type'] === 'project_deadline'));
    }

    public function test_timeline_overview_and_project_timeline(): void
    {
        $leader = User::factory()->create();
        $outsider = User::factory()->create();

        $project = Project::create([
            'title' => 'Timeline Project',
            'created_by' => $leader->id,
            'status' => Project::STATUS_ACTIVE,
        ]);
        ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'user_id' => $leader->id,
            'role' => RoleRegistry::ROLE_PROJECT_LEADER,
        ]);

        // 1. Timeline index overview
        $indexRes = $this->actingAs($leader)->getJson('/api/timeline');
        $indexRes->assertStatus(200)
            ->assertJsonPath('projects.0.id', (string) $project->id);

        // 2. Specific project timeline
        $timelineRes = $this->actingAs($leader)->getJson("/api/projects/{$project->id}/timeline");
        $timelineRes->assertStatus(200)
            ->assertJsonPath('success', true);

        // 3. Unauthorized access to timeline
        $unauthRes = $this->actingAs($outsider)->getJson("/api/projects/{$project->id}/timeline");
        $unauthRes->assertStatus(403);
    }

    public function test_notifications_list_and_read_management(): void
    {
        $user = User::factory()->create();
        $project = Project::create([
            'title' => 'Notif Project',
            'created_by' => $user->id,
            'status' => Project::STATUS_ACTIVE,
        ]);
        $committee = $project->committees()->create(['name' => 'Notif Committee']);
        $activity = $committee->activities()->create([
            'project_id' => $project->id,
            'created_by' => $user->id,
            'title' => 'Notif Activity',
        ]);
        $task = $activity->tasks()->create([
            'title' => 'Notif Task',
            'status' => Task::STATUS_TO_DO,
            'assigned_to' => $user->id,
        ]);

        $user->notify(new TaskAssignedNotification($task, $activity, $committee, $project));
        $this->assertEquals(1, $user->unreadNotifications()->count());
        $notificationId = $user->unreadNotifications()->first()->id;

        // 1. List notifications
        $listRes = $this->actingAs($user)->getJson('/api/notifications');
        $listRes->assertStatus(200)
            ->assertJsonPath('unread_count', 1);

        // 2. Mark specific notification as read
        $readRes = $this->actingAs($user)->postJson("/api/notifications/{$notificationId}/read");
        $readRes->assertStatus(200)
            ->assertJsonPath('unread_count', 0);

        // 3. Mark all as read
        $markAllRes = $this->actingAs($user)->postJson('/api/notifications/mark-all-read');
        $markAllRes->assertStatus(200)
            ->assertJsonPath('unread_count', 0);
    }

    public function test_project_group_chat_lifecycle_via_api(): void
    {
        $leader = User::factory()->create();
        $member = User::factory()->create();
        $outsider = User::factory()->create();

        $project = Project::create([
            'title' => 'Chat Collaborative Project',
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
            'user_id' => $member->id,
            'role' => RoleRegistry::ROLE_PROJECT_MEMBER,
        ]);

        $chat = Chat::create(['project_id' => $project->id]);

        // 1. Retrieve chat index
        $indexRes = $this->actingAs($member)->getJson("/api/chat/{$project->id}");
        $indexRes->assertStatus(200)
            ->assertJsonStructure([
                'chats',
                'active_chat',
                'messages',
                'project_members',
            ]);

        // 2. Member sends a message
        $sendRes = $this->actingAs($member)->postJson("/api/chat/{$chat->id}/messages", [
            'body' => 'Hello team, let us align on deliverables.',
        ]);
        $sendRes->assertStatus(200)
            ->assertJsonPath('body', 'Hello team, let us align on deliverables.')
            ->assertJsonPath('sender.id', $member->id);

        $messageId = $sendRes->json('id');

        // 3. Member marks chat read
        $readRes = $this->actingAs($member)->postJson("/api/chat/{$chat->id}/read", [
            'last_read_message_id' => $messageId,
        ]);
        $readRes->assertStatus(200)
            ->assertJsonPath('success', true);

        // 4. Leader toggles pin and mute
        $pinRes = $this->actingAs($leader)->postJson("/api/chat/{$chat->id}/pin");
        $pinRes->assertStatus(200)
            ->assertJsonPath('is_pinned', true);

        $muteRes = $this->actingAs($leader)->postJson("/api/chat/{$chat->id}/mute");
        $muteRes->assertStatus(200)
            ->assertJsonPath('is_muted', true);

        // 5. Outsider cannot access chat
        $outRes = $this->actingAs($outsider)->getJson("/api/chat/{$project->id}");
        $outRes->assertStatus(404);
    }
}
