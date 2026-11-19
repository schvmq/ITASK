<?php

namespace Tests\Feature;

use App\Models\Chat;
use App\Models\ChatMessage;
use App\Models\ChatReadState;
use App\Models\Committee;
use App\Models\Message;
use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Models\Task;
use App\Models\User;
use App\Services\Authorization\AuthorizationService;
use App\Services\SharedPropsService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PhaseBMiddlewarePerformanceTest extends TestCase
{
    use RefreshDatabase;

    public function test_phase_b_performance_comparison_and_contract_fidelity(): void
    {
        // ── 1. Setup realistic test state ──────────────────────────────────
        $leader = User::factory()->create(['name' => 'Event Chair', 'email_verified_at' => now()]);
        $member = User::factory()->create(['name' => 'Committee Member', 'email_verified_at' => now()]);
        $otherUser = User::factory()->create(['name' => 'Other Person', 'email_verified_at' => now()]);

        // Create 5 projects with chats
        for ($i = 1; $i <= 5; $i++) {
            $project = Project::create([
                'title' => "Event $i",
                'description' => "Event $i description",
                'status' => 'Active',
                'created_by' => $leader->id,
            ]);

            ProjectRoleAssignment::create([
                'project_id' => $project->id,
                'user_id' => $member->id,
                'role' => ProjectRoleAssignment::ROLE_PROJECT_MEMBER,
            ]);

            $chat = Chat::create([
                'project_id' => $project->id,
                'name' => "Chat $i",
            ]);

            // Add messages from other users
            $msg1 = Message::create([
                'chat_id' => $chat->id,
                'sender_id' => $otherUser->id,
                'body' => "Message 1 in Chat $i",
                'type' => 'text',
            ]);
            $msg2 = Message::create([
                'chat_id' => $chat->id,
                'sender_id' => $otherUser->id,
                'body' => "Message 2 in Chat $i",
                'type' => 'text',
            ]);

            // Member has read only up to msg1 in odd chats, nothing in even chats
            if ($i % 2 === 1) {
                ChatReadState::create([
                    'chat_id' => $chat->id,
                    'user_id' => $member->id,
                    'last_read_message_id' => $msg1->id,
                    'read_at' => now(),
                ]);
            }
        }

        // ── 2. Run Baseline (Original HandleInertiaRequests logic) ─────────
        DB::flushQueryLog();
        DB::enableQueryLog();
        $startBaseline = hrtime(true);

        // A. Unread notifications
        $baseNotifCount = $member->unreadNotifications()->count();

        // B. Recent notifications
        $baseRecentNotifs = $member->notifications()->latest()->take(5)->get()->count();

        // C. Unread messages (Original N+1 query loop)
        $chats = Chat::query()
            ->whereHas('project', function ($q) use ($member) {
                $q->whereNull('deleted_at')
                    ->where(function ($pq) use ($member) {
                        $pq->where('created_by', $member->id)
                            ->orWhereHas('roleAssignments', fn ($rq) => $rq->where('user_id', $member->id));
                    });
            })
            ->with('readStates')
            ->get();

        $baseUnreadMessages = 0;
        foreach ($chats as $chat) {
            $readState = $chat->readStates->firstWhere('user_id', $member->id);
            $lastReadMsgId = $readState?->last_read_message_id;
            $lastReadAt = $readState?->read_at;

            $count = $chat->messages()
                ->where(function ($mq) use ($member) {
                    $mq->where('sender_id', '!=', $member->id)
                        ->orWhereNull('sender_id');
                })
                ->when($lastReadMsgId, fn ($q) => $q->where('id', '>', $lastReadMsgId))
                ->when(! $lastReadMsgId && $lastReadAt, fn ($q) => $q->where('created_at', '>', $lastReadAt))
                ->count();

            $baseUnreadMessages += $count;
        }

        // D. My tasks count
        $baseMyTasks = Task::query()
            ->whereHas('activity.project')
            ->where(function ($q) use ($member) {
                $q->where('assigned_to', $member->id)
                  ->orWhereHas('assignees', fn ($uq) => $uq->where('user_id', $member->id));
            })
            ->where('status', '!=', Task::STATUS_COMPLETED)
            ->count();

        // E. Primary role & User roles (uncached)
        $authService = new AuthorizationService();
        $basePrimaryRole = $authService->getPrimaryRole($member);
        $baseUserRoles = $authService->getUserRoles($member);

        // F. Active projects
        $baseActiveProjects = Project::query()
            ->where(function ($q) use ($member) {
                $q->where('created_by', $member->id)
                  ->orWhereHas('roleAssignments', fn ($rq) => $rq->where('user_id', $member->id));
            })
            ->where('status', '!=', Project::STATUS_COMPLETED)
            ->count();

        // G. Pending reviews
        $basePendingReviews = Task::query()
            ->where('status', Task::STATUS_UNDER_REVIEW)
            ->whereHas('activity.committee', function ($q) use ($member) {
                $q->whereHas('roleAssignments', fn ($rq) => $rq->where('user_id', $member->id)->where('role', ProjectRoleAssignment::ROLE_PROJECT_STAFF))
                  ->orWhereHas('project', fn ($pq) => $pq->where('created_by', $member->id)->orWhereHas('roleAssignments', fn ($rq) => $rq->where('user_id', $member->id)->where('role', ProjectRoleAssignment::ROLE_PROJECT_LEADER)));
            })
            ->count();

        // H. Available users (Uncached full table scan)
        $baseAvailableUsers = User::query()
            ->where('id', '!=', $member->id)
            ->whereNotNull('email_verified_at')
            ->select(['id', 'name', 'email'])
            ->orderBy('name')
            ->get();

        $baselineMs = round((hrtime(true) - $startBaseline) / 1e6, 2);
        $baselineQueries = DB::getQueryLog();
        $baselineQueryCount = count($baselineQueries);
        $baselineQueryTimeMs = round(array_sum(array_column($baselineQueries, 'time')), 2);

        // ── 3. Run Optimized (Phase B SharedPropsService) ─────────────────
        $sharedProps = app(SharedPropsService::class);

        DB::flushQueryLog();
        DB::enableQueryLog();
        $startOptimized = hrtime(true);

        $optNotifCount = $sharedProps->unreadNotificationCount($member);
        $optRecentNotifs = count($sharedProps->recentNotifications($member));
        $optUnreadMessages = $sharedProps->unreadMessageCount($member);
        $optMyTasks = $sharedProps->myTasksCount($member);
        $optPrimaryRole = $sharedProps->primaryRole($member);
        $optUserRoles = $sharedProps->userRoles($member);
        $optActiveProjects = $sharedProps->activeProjectsCount($member);
        $optPendingReviews = $sharedProps->pendingReviewsCount($member);
        $optAvailableUsers = $sharedProps->availableUsers($member);

        $optimizedMs = round((hrtime(true) - $startOptimized) / 1e6, 2);
        $optimizedQueries = DB::getQueryLog();
        $optimizedQueryCount = count($optimizedQueries);
        $optimizedQueryTimeMs = round(array_sum(array_column($optimizedQueries, 'time')), 2);

        // ── 4. Verify exact data fidelity ─────────────────────────────────
        $this->assertEquals($baseUnreadMessages, $optUnreadMessages, 'Unread message count must match exactly');
        $this->assertEquals($basePrimaryRole, $optPrimaryRole, 'Primary role must match exactly');
        $this->assertEquals($baseUserRoles, $optUserRoles, 'User roles must match exactly');
        $this->assertEquals($baseMyTasks, $optMyTasks, 'My tasks count must match exactly');
        $this->assertEquals($baseActiveProjects, $optActiveProjects, 'Active projects count must match exactly');
        $this->assertEquals($basePendingReviews, $optPendingReviews, 'Pending reviews count must match exactly');
        $this->assertEquals($baseAvailableUsers->count(), count($optAvailableUsers), 'Available users count must match');

        // ── 5. Verify query reduction ─────────────────────────────────────
        // Baseline queries include:
        // 1 (notif count) + 1 (recent) + 1 (chats with project) + 1 (readStates eager load)
        // + 5 (messages count loop in 5 chats) + 1 (my tasks) + 2 (primary role) + 3 (user roles)
        // + 1 (active projects) + 1 (pending reviews) + 1 (available users) = 18 queries!
        // Optimized replaces the 5 message count queries with 1 aggregated query!
        $this->assertLessThan(
            $baselineQueryCount,
            $optimizedQueryCount,
            "Optimized query count ($optimizedQueryCount) must be strictly less than baseline ($baselineQueryCount)"
        );

        echo "\n" . str_repeat('=', 60) . "\n";
        echo "PHASE B BENCHMARK RESULTS (5 Chats, 3 Users):\n";
        echo sprintf("  Baseline Query Count:  %d queries (%.2f ms query time, %.2f ms total)\n", $baselineQueryCount, $baselineQueryTimeMs, $baselineMs);
        echo sprintf("  Optimized Query Count: %d queries (%.2f ms query time, %.2f ms total)\n", $optimizedQueryCount, $optimizedQueryTimeMs, $optimizedMs);
        echo sprintf("  Query Reduction:       %d fewer queries (%.1f%% reduction)\n",
            $baselineQueryCount - $optimizedQueryCount,
            (($baselineQueryCount - $optimizedQueryCount) / $baselineQueryCount) * 100
        );
        echo sprintf("  Unread Messages Count: %d (Both identical)\n", $optUnreadMessages);
        echo sprintf("  Primary Role:          %s (Both identical)\n", $optPrimaryRole);
        echo str_repeat('=', 60) . "\n";
    }

    public function test_repeated_role_and_user_resolution_is_zero_query_within_request(): void
    {
        $member = User::factory()->create(['name' => 'Test User', 'email_verified_at' => now()]);
        $sharedProps = app(SharedPropsService::class);

        // Warm up first call
        $sharedProps->primaryRole($member);
        $sharedProps->userRoles($member);
        $sharedProps->availableUsers($member);

        // Now subsequent calls in the same request (e.g. from Policy or Controller)
        DB::flushQueryLog();
        DB::enableQueryLog();

        $role1 = $sharedProps->primaryRole($member);
        $role2 = $sharedProps->primaryRole($member);
        $roles1 = $sharedProps->userRoles($member);
        $roles2 = $sharedProps->userRoles($member);
        $users1 = $sharedProps->availableUsers($member);
        $users2 = $sharedProps->availableUsers($member);

        $queries = DB::getQueryLog();
        DB::disableQueryLog();

        $this->assertCount(0, $queries, 'Repeated role/user resolutions within the same request must trigger ZERO additional queries');
        $this->assertEquals($role1, $role2);
        $this->assertEquals($roles1, $roles2);
        $this->assertEquals($users1, $users2);
    }

    public function test_authorization_memoization_is_strictly_isolated_by_user(): void
    {
        $leader = User::factory()->create(['name' => 'Leader User', 'email_verified_at' => now()]);
        $member = User::factory()->create(['name' => 'Member User', 'email_verified_at' => now()]);
        $staff = User::factory()->create(['name' => 'Staff User', 'email_verified_at' => now()]);

        $project = Project::create([
            'title' => 'Isolation Project',
            'status' => 'Active',
            'created_by' => $leader->id,
        ]);

        ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'user_id' => $staff->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_STAFF,
        ]);

        ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'user_id' => $member->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_MEMBER,
        ]);

        $authService = new AuthorizationService();

        // Resolve all roles in same process
        $leaderRole = $authService->getPrimaryRole($leader);
        $staffRole  = $authService->getPrimaryRole($staff);
        $memberRole = $authService->getPrimaryRole($member);

        $leaderRoles = $authService->getUserRoles($leader);
        $staffRoles  = $authService->getUserRoles($staff);
        $memberRoles = $authService->getUserRoles($member);

        // Strict isolation checks: Each user must receive their own distinct role
        $this->assertEquals(\App\Services\Authorization\RoleRegistry::ROLE_PROJECT_LEADER, $leaderRole);
        $this->assertEquals(\App\Services\Authorization\RoleRegistry::ROLE_PROJECT_COMMITTEE, $staffRole);
        $this->assertEquals(\App\Services\Authorization\RoleRegistry::ROLE_COMMITTEE_STAFF, $memberRole);

        $this->assertContains(\App\Services\Authorization\RoleRegistry::ROLE_PROJECT_LEADER, $leaderRoles);
        $this->assertNotContains(\App\Services\Authorization\RoleRegistry::ROLE_PROJECT_LEADER, $staffRoles);
        $this->assertNotContains(\App\Services\Authorization\RoleRegistry::ROLE_PROJECT_LEADER, $memberRoles);

        $this->assertContains(\App\Services\Authorization\RoleRegistry::ROLE_PROJECT_STAFF, $staffRoles);
        $this->assertNotContains(\App\Services\Authorization\RoleRegistry::ROLE_PROJECT_STAFF, $memberRoles);
    }

    public function test_chat_unread_count_all_edge_cases_against_original_logic(): void
    {
        $user = User::factory()->create(['name' => 'Target User', 'email_verified_at' => now()]);
        $otherUser = User::factory()->create(['name' => 'Sender User', 'email_verified_at' => now()]);

        // Helper to create a project for a chat
        $createProjectWithChat = function (string $name) use ($user) {
            $p = Project::create([
                'title' => "Proj $name",
                'status' => 'Active',
                'created_by' => $user->id,
            ]);
            return Chat::create(['project_id' => $p->id, 'name' => $name]);
        };

        // 1. Chat A: No read-state record exists at all
        $chatA = $createProjectWithChat('Chat A');
        Message::create(['chat_id' => $chatA->id, 'sender_id' => $otherUser->id, 'body' => 'Msg A1', 'type' => 'text']);
        Message::create(['chat_id' => $chatA->id, 'sender_id' => $otherUser->id, 'body' => 'Msg A2', 'type' => 'text']);

        // 2. Chat B: Read-state record exists with NULL values
        $chatB = $createProjectWithChat('Chat B');
        ChatReadState::create(['chat_id' => $chatB->id, 'user_id' => $user->id, 'last_read_message_id' => null, 'read_at' => null]);
        Message::create(['chat_id' => $chatB->id, 'sender_id' => $otherUser->id, 'body' => 'Msg B1', 'type' => 'text']);

        // 3. Chat C: Valid last-read message ID
        $chatC = $createProjectWithChat('Chat C');
        $msgC1 = Message::create(['chat_id' => $chatC->id, 'sender_id' => $otherUser->id, 'body' => 'Msg C1', 'type' => 'text']);
        $msgC2 = Message::create(['chat_id' => $chatC->id, 'sender_id' => $otherUser->id, 'body' => 'Msg C2', 'type' => 'text']);
        ChatReadState::create(['chat_id' => $chatC->id, 'user_id' => $user->id, 'last_read_message_id' => $msgC1->id, 'read_at' => now()]);

        // 4. Chat D: Timestamp-based read state (last_read_message_id is null)
        $chatD = $createProjectWithChat('Chat D');
        $msgD1 = Message::create(['chat_id' => $chatD->id, 'sender_id' => $otherUser->id, 'body' => 'Msg D1', 'type' => 'text']);
        $msgD1->created_at = now()->subMinutes(10);
        $msgD1->save();
        $readTime = now()->subMinutes(5);
        $msgD2 = Message::create(['chat_id' => $chatD->id, 'sender_id' => $otherUser->id, 'body' => 'Msg D2', 'type' => 'text']);
        ChatReadState::create(['chat_id' => $chatD->id, 'user_id' => $user->id, 'last_read_message_id' => null, 'read_at' => $readTime]);

        // 5. Chat E: Soft-deleted messages, own messages, and system messages
        $chatE = $createProjectWithChat('Chat E');
        // Own message -> must be ignored
        Message::create(['chat_id' => $chatE->id, 'sender_id' => $user->id, 'body' => 'My own message', 'type' => 'text']);
        // System message -> must be counted
        Message::create(['chat_id' => $chatE->id, 'sender_id' => null, 'body' => 'System notification', 'type' => 'system']);
        // Soft-deleted message -> must be ignored
        $deletedMsg = Message::create(['chat_id' => $chatE->id, 'sender_id' => $otherUser->id, 'body' => 'Deleted text', 'type' => 'text']);
        $deletedMsg->delete();

        // ── Execute original loop logic ──
        $chats = Chat::query()
            ->whereHas('project', function ($q) use ($user) {
                $q->whereNull('deleted_at')
                    ->where(function ($pq) use ($user) {
                        $pq->where('created_by', $user->id)
                            ->orWhereHas('roleAssignments', fn ($rq) => $rq->where('user_id', $user->id));
                    });
            })
            ->with('readStates')
            ->get();

        $originalTotal = 0;
        foreach ($chats as $chat) {
            $readState = $chat->readStates->firstWhere('user_id', $user->id);
            $lastReadMsgId = $readState?->last_read_message_id;
            $lastReadAt = $readState?->read_at;

            $count = $chat->messages()
                ->where(function ($mq) use ($user) {
                    $mq->where('sender_id', '!=', $user->id)
                        ->orWhereNull('sender_id');
                })
                ->when($lastReadMsgId, fn ($q) => $q->where('id', '>', $lastReadMsgId))
                ->when(! $lastReadMsgId && $lastReadAt, fn ($q) => $q->where('created_at', '>', $lastReadAt))
                ->count();

            $originalTotal += $count;
        }

        // ── Execute optimized query logic ──
        $optimizedTotal = app(SharedPropsService::class)->unreadMessageCount($user);

        // Verification:
        // Chat A: 2 unread (Msg A1, Msg A2)
        // Chat B: 1 unread (Msg B1)
        // Chat C: 1 unread (Msg C2)
        // Chat D: 1 unread (Msg D2)
        // Chat E: 1 unread (System message; own and deleted are excluded)
        // Expected total = 6
        $this->assertEquals(6, $originalTotal, 'Original loop logic calculation verification');
        $this->assertEquals($originalTotal, $optimizedTotal, 'Optimized SQL query must match original logic across ALL 8 edge cases');
    }
}
