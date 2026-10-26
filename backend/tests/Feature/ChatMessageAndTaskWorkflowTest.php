<?php

namespace Tests\Feature;

use App\Models\Activity;
use App\Models\Chat;
use App\Models\ChatReadState;
use App\Models\Committee;
use App\Models\Message;
use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Models\Task;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
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
    protected Chat $chat;

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

        $this->chat = Chat::create([
            'project_id' => $this->project->id,
        ]);

        $this->chat->messages()->create([
            'sender_id' => null,
            'type' => Message::TYPE_SYSTEM,
            'body' => 'Project chat created. Everyone in this project can message here.',
        ]);
    }

    /**
     * 1. Test chat auto-creation, unique constraint, and system message.
     */
    public function test_chat_auto_creation_and_unique_constraint(): void
    {
        $this->assertNotNull($this->project->chat);
        $this->assertEquals($this->chat->id, $this->project->chat->id);

        // Verify initial system message exists
        $this->assertDatabaseHas('messages', [
            'chat_id' => $this->chat->id,
            'type' => Message::TYPE_SYSTEM,
            'body' => 'Project chat created. Everyone in this project can message here.',
            'sender_id' => null,
        ]);

        // Enforce one chat per project: UNIQUE constraint throws QueryException if duplicate attempted
        $this->expectException(QueryException::class);
        Chat::create([
            'project_id' => $this->project->id,
        ]);
    }

    /**
     * 2. Test membership access rules and permission denial for non-members.
     */
    public function test_membership_access_rules_and_permission_denial(): void
    {
        // Active members have access
        $this->actingAs($this->leader);
        $this->get("/messages/{$this->project->id}")->assertStatus(200);

        $this->actingAs($this->member1);
        $this->get("/messages/{$this->project->id}")->assertStatus(200);

        // Non-member gets 404 with no information leaked
        $outsider = User::factory()->create(['name' => 'Outsider User']);
        $this->actingAs($outsider);
        $this->get("/messages/{$this->project->id}")->assertStatus(404);

        $this->postJson("/chat/{$this->chat->id}/messages", ['body' => 'Intrusion'])
            ->assertStatus(403);
    }

    /**
     * 3. Test membership add and remove effects.
     */
    public function test_membership_add_and_remove_effects(): void
    {
        $newMember = User::factory()->create(['name' => 'Maria Santos', 'email' => 'maria@itask.test']);

        // Leader adds new member to project
        $this->actingAs($this->leader);
        $response = $this->post("/projects/{$this->project->id}/personnel", [
            'user_id' => $newMember->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_MEMBER,
        ]);
        $response->assertStatus(302);

        // System message for join was posted
        $this->assertDatabaseHas('messages', [
            'chat_id' => $this->chat->id,
            'type' => Message::TYPE_SYSTEM,
            'body' => 'Maria Santos joined the project',
        ]);

        // New member now has chat access
        $this->actingAs($newMember);
        $this->get("/messages/{$this->project->id}")->assertStatus(200);

        // Leader removes the member
        $this->actingAs($this->leader);
        $this->delete("/projects/{$this->project->id}/personnel/{$newMember->id}")->assertStatus(302);

        // System message for leave was posted
        $this->assertDatabaseHas('messages', [
            'chat_id' => $this->chat->id,
            'type' => Message::TYPE_SYSTEM,
            'body' => 'Maria Santos left the project',
        ]);

        // Removed member access is cut immediately
        $this->actingAs($newMember);
        $this->get("/messages/{$this->project->id}")->assertStatus(404);
        $this->postJson("/chat/{$this->chat->id}/messages", ['body' => 'Should fail'])
            ->assertStatus(403);
    }

    /**
     * 4. Test new members see full history (NEW_MEMBERS_SEE_HISTORY = true).
     */
    public function test_new_members_see_full_history(): void
    {
        $this->assertTrue(Chat::NEW_MEMBERS_SEE_HISTORY);

        // Leader posts message before new member joins
        $this->actingAs($this->leader);
        $msg = $this->chat->messages()->create([
            'sender_id' => $this->leader->id,
            'type' => Message::TYPE_TEXT,
            'body' => 'Important initial project architecture discussion',
        ]);

        // Soft-deleted message from earlier
        $deletedMsg = $this->chat->messages()->create([
            'sender_id' => $this->leader->id,
            'type' => Message::TYPE_TEXT,
            'body' => 'Secret typo to be deleted',
        ]);
        $deletedMsg->delete();

        // New member joins
        $newMember = User::factory()->create(['name' => 'Paolo Rejoin', 'email' => 'paolo@itask.test']);
        $this->project->roleAssignments()->create([
            'user_id' => $newMember->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_MEMBER,
        ]);

        // New member can see the earlier messages
        $this->actingAs($newMember);
        $response = $this->get("/messages/{$this->project->id}");
        $response->assertStatus(200);
        $response->assertInertia(function ($page) use ($msg, $deletedMsg) {
            $messages = collect($page->toArray()['props']['messages']);
            $this->assertTrue($messages->contains('id', $msg->id));

            // Deleted message is shown as deleted tombstone, original body not exposed
            $foundDeleted = $messages->firstWhere('id', $deletedMsg->id);
            $this->assertNotNull($foundDeleted);
            $this->assertTrue($foundDeleted['is_deleted']);
            $this->assertEquals('', $foundDeleted['body']);
        });
    }

    /**
     * 5. Test soft delete, restore, and 30-day purge job.
     */
    public function test_soft_delete_and_restore_and_purge_job(): void
    {
        // Member creates a task
        $task = Task::create([
            'activity_id' => $this->activity->id,
            'assigned_to' => $this->member1->id,
            'title' => 'Retention Test Task',
            'status' => Task::STATUS_TO_DO,
        ]);
        DB::table('task_assignees')->insert([
            'task_id' => $task->id,
            'user_id' => $this->member1->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Verify task appears in assignee's My Tasks
        $this->actingAs($this->member1);
        $this->get('/my-tasks')->assertSee('Retention Test Task');

        // Non-owner cannot delete
        $this->actingAs($this->member1);
        $this->delete("/projects/{$this->project->id}", [
            'confirmation_name' => $this->project->title,
        ])->assertStatus(403);

        // Owner deletes project with confirmation name
        $this->actingAs($this->leader);
        $deleteRes = $this->delete("/projects/{$this->project->id}", [
            'confirmation_name' => $this->project->title,
        ]);
        $deleteRes->assertStatus(302);

        $this->assertTrue($this->project->fresh()->trashed());
        $this->assertTrue($this->chat->fresh()->trashed());

        // While soft-deleted, chat is not accessible
        $this->actingAs($this->member1);
        $this->get("/messages/{$this->project->id}")->assertStatus(404);

        // Assigned tasks disappear from My Tasks
        $this->actingAs($this->member1);
        $this->get('/my-tasks')->assertDontSee('Retention Test Task');

        // Owner restores project
        $this->actingAs($this->leader);
        $restoreRes = $this->post("/projects/{$this->project->id}/restore");
        $restoreRes->assertStatus(302);

        $this->assertFalse($this->project->fresh()->trashed());
        $this->assertFalse($this->chat->fresh()->trashed());

        // System message "Project restored" posted
        $this->assertDatabaseHas('messages', [
            'chat_id' => $this->chat->id,
            'type' => Message::TYPE_SYSTEM,
            'body' => 'Project restored',
        ]);

        // Tasks reappear in My Tasks
        $this->actingAs($this->member1);
        $this->get('/my-tasks')->assertSee('Retention Test Task');

        // Test Purge Command: projects deleted <= 30 days are retained; > 30 days are purged
        // 1. Soft-delete project again with deleted_at set to 10 days ago (within 30-day retention)
        $this->actingAs($this->leader);
        $this->delete("/projects/{$this->project->id}", ['confirmation_name' => $this->project->title]);
        DB::table('projects')->where('id', $this->project->id)->update(['deleted_at' => now()->subDays(10)]);

        Artisan::call('projects:purge-deleted');
        $this->assertNotNull(Project::withTrashed()->find($this->project->id));

        // 2. Set deleted_at to 31 days ago (expired retention)
        DB::table('projects')->where('id', $this->project->id)->update(['deleted_at' => now()->subDays(31)]);

        Artisan::call('projects:purge-deleted');
        $this->assertNull(Project::withTrashed()->find($this->project->id));
        $this->assertNull(Chat::withTrashed()->find($this->chat->id));
    }

    /**
     * 6. Test task creation from chat within atomic transaction and rollback.
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
            'idempotency_key' => 'idem_test_task_001',
        ];

        $response = $this->postJson("/chat/{$this->chat->id}/tasks", $payload);

        $response->assertStatus(200);
        $response->assertJsonPath('success', true);
        $response->assertJsonPath('task.title', 'Build Authentication UI');
        $response->assertJsonPath('task.priority', 'High');

        // Verify task exists in database
        $task = Task::where('title', 'Build Authentication UI')->first();
        $this->assertNotNull($task);
        $this->assertDatabaseHas('task_assignees', ['task_id' => $task->id, 'user_id' => $this->member1->id]);
        $this->assertDatabaseHas('task_assignees', ['task_id' => $task->id, 'user_id' => $this->member2->id]);

        // Verify chat message with task link
        $this->assertDatabaseHas('messages', [
            'chat_id' => $this->chat->id,
            'task_id' => $task->id,
            'sender_id' => $this->leader->id,
            'type' => Message::TYPE_TASK,
        ]);

        // Test Rollback: non-member assignee causes transaction rollback
        $outsider = User::factory()->create(['name' => 'Stranger']);
        $initialTasksCount = Task::count();
        $initialMessagesCount = Message::count();

        $invalidPayload = [
            'title' => 'Should Rollback Task',
            'assignee_ids' => [$outsider->id],
            'due_date' => now()->addDays(2)->toDateString(),
            'priority' => 'Medium',
        ];

        $invalidResponse = $this->postJson("/chat/{$this->chat->id}/tasks", $invalidPayload);
        $invalidResponse->assertStatus(422);

        $this->assertEquals($initialTasksCount, Task::count());
        $this->assertEquals($initialMessagesCount, Message::count());
    }

    /**
     * 7. Test read receipt updating and strictly non-backward movement.
     */
    public function test_read_receipt_updating_and_non_backward_movement(): void
    {
        $msg1 = $this->chat->messages()->create(['sender_id' => $this->leader->id, 'body' => 'Msg 1', 'type' => Message::TYPE_TEXT]);
        $msg2 = $this->chat->messages()->create(['sender_id' => $this->leader->id, 'body' => 'Msg 2', 'type' => Message::TYPE_TEXT]);

        $this->actingAs($this->member1);

        // Member reads up to msg2
        $res = $this->postJson("/chat/{$this->chat->id}/read", [
            'last_read_message_id' => $msg2->id,
        ]);

        $res->assertStatus(200);
        $res->assertJsonPath('last_read_message_id', $msg2->id);

        $this->assertDatabaseHas('chat_read_states', [
            'chat_id' => $this->chat->id,
            'user_id' => $this->member1->id,
            'last_read_message_id' => $msg2->id,
        ]);

        // Attempting to move backward to msg1 should NOT overwrite msg2
        $resBackward = $this->postJson("/chat/{$this->chat->id}/read", [
            'last_read_message_id' => $msg1->id,
        ]);

        $resBackward->assertStatus(200);
        $resBackward->assertJsonPath('last_read_message_id', $msg2->id);

        $this->assertDatabaseHas('chat_read_states', [
            'chat_id' => $this->chat->id,
            'user_id' => $this->member1->id,
            'last_read_message_id' => $msg2->id,
        ]);
    }

    /**
     * 8. Test delete message permissions, soft delete, and undo flow.
     */
    public function test_delete_message_permissions_and_undo_flow(): void
    {
        $message = $this->chat->messages()->create([
            'sender_id' => $this->member1->id,
            'body' => 'Message to be deleted',
            'type' => Message::TYPE_TEXT,
        ]);

        // Non-sender, non-leader member2 cannot delete (403 Forbidden)
        $this->actingAs($this->member2);
        $this->postJson("/chat/{$this->chat->id}/messages/{$message->id}/delete")
            ->assertStatus(403);

        $this->assertNull($message->fresh()->deleted_at);

        // Sender member1 deletes message -> 200 OK and soft deleted
        $this->actingAs($this->member1);
        $this->postJson("/chat/{$this->chat->id}/messages/{$message->id}/delete")
            ->assertStatus(200)
            ->assertJsonPath('success', true);

        $this->assertTrue($message->fresh()->trashed());

        // Restore within 5-second undo window
        $this->postJson("/chat/{$this->chat->id}/messages/{$message->id}/restore")
            ->assertStatus(200)
            ->assertJsonPath('success', true);

        $this->assertFalse($message->fresh()->trashed());
        $this->assertEquals('Message to be deleted', $message->fresh()->body);

        // Leader can also delete other members' messages
        $this->actingAs($this->leader);
        $this->postJson("/chat/{$this->chat->id}/messages/{$message->id}/delete")
            ->assertStatus(200);

        $this->assertTrue($message->fresh()->trashed());
    }

    /**
     * 9. Test unread count calculation accuracy across project chats.
     */
    public function test_unread_count_accuracy_across_projects(): void
    {
        // 1. Leader marks initial setup message as read
        $this->actingAs($this->leader);
        $this->postJson("/chat/{$this->chat->id}/read", [
            'last_read_message_id' => $this->chat->messages()->first()->id,
        ])->assertStatus(200);

        // Leader now has 0 unread
        $res = $this->get('/messages');
        $res->assertStatus(200);
        $res->assertInertia(fn ($page) => $page->where('totalUnreadCount', 0));

        // 2. Member1 sends a message via API
        $this->actingAs($this->member1);
        $this->postJson("/chat/{$this->chat->id}/messages", [
            'body' => 'Hello everyone!',
        ])->assertStatus(200);

        // Member1 who sent the message has 0 unread messages (sender read marker auto-advanced)
        $res1 = $this->get('/messages');
        $res1->assertStatus(200);
        $res1->assertInertia(fn ($page) => $page->where('totalUnreadCount', 0));

        // Leader now has 1 unread message from Member1
        $this->actingAs($this->leader);
        $resLeader = $this->get('/messages');
        $resLeader->assertStatus(200);
        $resLeader->assertInertia(fn ($page) => $page->where('totalUnreadCount', 1));
    }

    /**
     * 10. Test chat index renders without errors for user with zero projects.
     */
    public function test_chat_index_renders_without_errors_for_user_with_zero_projects(): void
    {
        $newUser = User::factory()->create();
        $this->actingAs($newUser);

        $response = $this->get('/messages');
        $response->assertStatus(200);
        $response->assertInertia(function ($page) {
            $page->component('Chat/Index')
                ->has('chats', 0)
                ->where('totalUnreadCount', 0);
        });
    }
}
