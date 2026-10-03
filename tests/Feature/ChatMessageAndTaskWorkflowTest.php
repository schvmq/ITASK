<?php

namespace Tests\Feature;

use App\Models\Activity;
use App\Models\Committee;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ChatMessageAndTaskWorkflowTest extends TestCase
{
    use RefreshDatabase;

    protected User $leader;
    protected User $member1;
    protected User $member2;
    protected Project $project;
    protected Committee $committee;
    protected Activity $activity;
    protected Conversation $conversation;

    protected function setUp(): void
    {
        parent::setUp();

        $this->leader = User::factory()->create(['name' => 'Leader User', 'email' => 'leader@itask.test']);
        $this->member1 = User::factory()->create(['name' => 'Member One', 'email' => 'member1@itask.test']);
        $this->member2 = User::factory()->create(['name' => 'Member Two', 'email' => 'member2@itask.test']);

        $this->project = Project::create([
            'title' => 'Capstone Chat Project',
            'created_by' => $this->leader->id,
            'status' => 'Planning',
        ]);

        $this->project->roleAssignments()->createMany([
            ['user_id' => $this->leader->id, 'role' => ProjectRoleAssignment::ROLE_PROJECT_LEADER],
            ['user_id' => $this->member1->id, 'role' => ProjectRoleAssignment::ROLE_PROJECT_MEMBER],
            ['user_id' => $this->member2->id, 'role' => ProjectRoleAssignment::ROLE_PROJECT_MEMBER],
        ]);

        $this->committee = $this->project->committees()->create([
            'name' => 'Development Committee',
        ]);

        $this->activity = $this->committee->activities()->create([
            'project_id' => $this->project->id,
            'created_by' => $this->leader->id,
            'title' => 'Sprint 1 Tasks',
            'status' => 'To Do',
        ]);

        $this->conversation = Conversation::create([
            'type' => 'project',
            'title' => 'Project Capstone Chat',
            'project_id' => $this->project->id,
            'created_by' => $this->leader->id,
        ]);

        $this->conversation->participants()->createMany([
            ['user_id' => $this->leader->id, 'last_read_at' => now()],
            ['user_id' => $this->member1->id, 'last_read_at' => now()],
            ['user_id' => $this->member2->id, 'last_read_at' => now()],
        ]);
    }

    /**
     * 1. Test Task Creation from Chat within Atomic Transaction and Rollback on Failure.
     */
    public function test_task_creation_from_chat_atomic_transaction_and_rollback(): void
    {
        $this->actingAs($this->leader);

        $payload = [
            'title' => 'Build Authentication UI',
            'description' => 'Complete the login and registration UI with tokens',
            'assignee_ids' => [$this->member1->id, $this->member2->id],
            'due_date' => now()->addDays(5)->toDateString(),
            'priority' => 'High',
            'project_id' => $this->project->id,
            'idempotency_key' => 'idem_test_123',
        ];

        $response = $this->postJson("/chat/{$this->conversation->id}/tasks", $payload);

        $response->assertStatus(200);
        $response->assertJsonPath('success', true);
        $response->assertJsonPath('task.title', 'Build Authentication UI');
        $response->assertJsonPath('task.priority', 'High');

        // Verify task was created in database
        $this->assertDatabaseHas('tasks', [
            'title' => 'Build Authentication UI',
            'priority' => 'High',
        ]);

        // Verify task assignees created for both assignees
        $task = Task::where('title', 'Build Authentication UI')->first();
        $this->assertNotNull($task);
        $this->assertDatabaseHas('task_assignees', ['task_id' => $task->id, 'user_id' => $this->member1->id]);
        $this->assertDatabaseHas('task_assignees', ['task_id' => $task->id, 'user_id' => $this->member2->id]);

        // Verify chat message with task link
        $this->assertDatabaseHas('messages', [
            'conversation_id' => $this->conversation->id,
            'task_id' => $task->id,
            'sender_id' => $this->leader->id,
        ]);

        // Test Rollback: non-member assignee causes transaction rollback (nothing created)
        $nonMember = User::factory()->create(['name' => 'Stranger']);
        $initialTasksCount = Task::count();
        $initialMessagesCount = Message::count();

        $invalidPayload = [
            'title' => 'Should Rollback Task',
            'assignee_ids' => [$nonMember->id],
            'due_date' => now()->addDays(2)->toDateString(),
            'priority' => 'Medium',
            'project_id' => $this->project->id,
        ];

        $invalidResponse = $this->postJson("/chat/{$this->conversation->id}/tasks", $invalidPayload);
        $invalidResponse->assertStatus(422);

        $this->assertEquals($initialTasksCount, Task::count());
        $this->assertEquals($initialMessagesCount, Message::count());
    }

    /**
     * 2. Test Task Created from Chat Appears in Assignee's My Tasks.
     */
    public function test_task_created_from_chat_appears_in_assignees_my_tasks(): void
    {
        $this->actingAs($this->leader);

        $payload = [
            'title' => 'Design System Tokens Audit',
            'description' => 'Check color tokens',
            'assignee_ids' => [$this->member1->id],
            'due_date' => now()->addDays(3)->toDateString(),
            'priority' => 'Medium',
            'project_id' => $this->project->id,
        ];

        $this->postJson("/chat/{$this->conversation->id}/tasks", $payload)->assertStatus(200);

        // Assignee visits My Tasks
        $this->actingAs($this->member1);
        $response = $this->get('/my-tasks');

        $response->assertStatus(200);
        $response->assertInertia(function ($page) {
            $page->component('MyTasks/Index')
                ->has('tasks')
                ->where('tasks.0.title', 'Design System Tokens Audit')
                ->where('tasks.0.priority', 'Medium');
        });
    }

    /**
     * 3. Test Read Receipt Updating and Strictly Non-Backward Movement.
     */
    public function test_read_receipt_updating_and_non_backward_movement(): void
    {
        $msg1 = $this->conversation->messages()->create(['sender_id' => $this->leader->id, 'body' => 'Msg 1']);
        $msg2 = $this->conversation->messages()->create(['sender_id' => $this->leader->id, 'body' => 'Msg 2']);

        $this->actingAs($this->member1);

        // Member reads up to msg2
        $res = $this->postJson("/chat/{$this->conversation->id}/read", [
            'last_read_message_id' => $msg2->id,
        ]);

        $res->assertStatus(200);
        $res->assertJsonPath('last_read_message_id', $msg2->id);

        $this->assertDatabaseHas('conversation_participants', [
            'conversation_id' => $this->conversation->id,
            'user_id' => $this->member1->id,
            'last_read_message_id' => $msg2->id,
        ]);

        // Attempting to move backward to msg1 should NOT overwrite msg2
        $resBackward = $this->postJson("/chat/{$this->conversation->id}/read", [
            'last_read_message_id' => $msg1->id,
        ]);

        $resBackward->assertStatus(200);
        $resBackward->assertJsonPath('last_read_message_id', $msg2->id);

        $this->assertDatabaseHas('conversation_participants', [
            'conversation_id' => $this->conversation->id,
            'user_id' => $this->member1->id,
            'last_read_message_id' => $msg2->id,
        ]);
    }

    /**
     * 4. Test Delete Message Permissions and Soft Delete Behavior.
     */
    public function test_delete_message_permissions_and_soft_delete(): void
    {
        $message = $this->conversation->messages()->create([
            'sender_id' => $this->member1->id,
            'body' => 'Secret message to be deleted',
        ]);

        // User member2 (not sender, not project leader) attempts to delete -> 403 Forbidden
        $this->actingAs($this->member2);
        $this->postJson("/chat/{$this->conversation->id}/messages/{$message->id}/delete")
            ->assertStatus(403);

        $this->assertNull($message->fresh()->deleted_at);

        // Sender member1 deletes message -> 200 OK and soft deleted
        $this->actingAs($this->member1);
        $this->postJson("/chat/{$this->conversation->id}/messages/{$message->id}/delete")
            ->assertStatus(200)
            ->assertJsonPath('success', true);

        $this->assertNotNull($message->fresh()->deleted_at);
    }

    /**
     * 5. Test Undo Flow Restores Message.
     */
    public function test_undo_flow_restores_message(): void
    {
        $message = $this->conversation->messages()->create([
            'sender_id' => $this->member1->id,
            'body' => 'Accidentally deleted message',
        ]);

        $this->actingAs($this->member1);

        // Soft delete
        $this->postJson("/chat/{$this->conversation->id}/messages/{$message->id}/delete")->assertStatus(200);
        $this->assertTrue($message->fresh()->trashed());

        // Restore within 5-second undo window
        $this->postJson("/chat/{$this->conversation->id}/messages/{$message->id}/restore")
            ->assertStatus(200)
            ->assertJsonPath('success', true);

        $this->assertFalse($message->fresh()->trashed());
        $this->assertEquals('Accidentally deleted message', $message->fresh()->body);
    }

    /**
     * 6. Test Chat Index renders without relation error for any user account.
     */
    public function test_chat_index_renders_without_relation_error_for_any_user_account(): void
    {
        // 1. Existing leader with created project
        $this->actingAs($this->leader);
        $response1 = $this->get('/messages');
        $response1->assertStatus(200);
        $response1->assertInertia(fn ($page) => $page->component('Chat/Index')->has('userProjects'));

        // 2. Member with role assignment
        $this->actingAs($this->member1);
        $response2 = $this->get('/messages');
        $response2->assertStatus(200);
        $response2->assertInertia(fn ($page) => $page->component('Chat/Index')->has('userProjects'));

        // 3. Brand new user account with zero projects or assignments
        $newUser = User::factory()->create();
        $this->actingAs($newUser);
        $response3 = $this->get('/messages');
        $response3->assertStatus(200);
        $response3->assertInertia(fn ($page) => $page->component('Chat/Index')->has('userProjects', 0));
    }
}
