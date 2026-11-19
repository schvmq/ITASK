<?php

namespace App\Services;

use App\Models\Chat;
use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Models\Task;
use App\Models\User;
use App\Services\Authorization\AuthorizationService;
use Illuminate\Support\Facades\DB;

/**
 * SharedPropsService
 *
 * Responsible for computing the data surfaced as Inertia shared props on every
 * authenticated page load.  Extracted from HandleInertiaRequests to enforce
 * separation of concerns and to make each computation independently testable.
 *
 * Performance notes
 * -----------------
 * - Unread message count uses a single aggregated SQL query (not N+1).
 * - Role resolution is delegated to AuthorizationService which memoises its
 *   results for the duration of the request via PHP's `once()` helper.
 * - `available_users` is intentionally NOT computed here; it is served by a
 *   dedicated API endpoint (/api/users/available) that pages fetch lazily.
 */
class SharedPropsService
{
    public function __construct(
        private readonly AuthorizationService $authService,
    ) {}

    /**
     * Compute unread notification count for the given user.
     */
    public function unreadNotificationCount(User $user): int
    {
        return $user->unreadNotifications()->count();
    }

    /**
     * Return the five most recent notifications for the given user.
     *
     * @return array<int, array<string, mixed>>
     */
    public function recentNotifications(User $user): array
    {
        return $user->notifications()
            ->latest()
            ->take(5)
            ->get()
            ->map(fn ($notif) => [
                'id'               => $notif->id,
                'type'             => $notif->type,
                'data'             => $notif->data,
                'read_at'          => $notif->read_at?->toISOString(),
                'created_at'       => $notif->created_at?->toISOString(),
                'created_at_human' => $notif->created_at?->diffForHumans(),
            ])
            ->all();
    }

    /**
     * Compute the total number of unread chat messages for the given user.
     *
     * Uses a single aggregated SQL query instead of one COUNT per chat room,
     * eliminating the N+1 pattern that was present in the original middleware.
     *
     * Strategy
     * --------
     * 1. Resolve all chat IDs the user participates in (one query).
     * 2. For each chat, the user's last-read position is stored in
     *    `chat_read_states` as either `last_read_message_id` or `read_at`.
     * 3. We LEFT JOIN `chat_read_states` onto `messages` and count rows where
     *    the message ID exceeds the last-read ID, excluding the user's own
     *    messages and system messages (NULL sender_id is included as unread).
     *
     * Note: chats where the user has NEVER read anything (no read-state row)
     * count all non-own messages as unread, matching the original behaviour.
     */
    public function unreadMessageCount(User $user): int
    {
        // 1. Gather chat IDs the user belongs to (via project membership).
        $chatIds = Chat::query()
            ->whereHas('project', function ($q) use ($user) {
                $q->whereNull('deleted_at')
                    ->where(function ($pq) use ($user) {
                        $pq->where('created_by', $user->id)
                           ->orWhereHas('roleAssignments', fn ($rq) => $rq->where('user_id', $user->id));
                    });
            })
            ->pluck('id');

        if ($chatIds->isEmpty()) {
            return 0;
        }

        // 2. Single aggregated query: count messages that are "newer" than the
        //    user's last-read position in each chat, excluding own messages.
        $count = DB::table('messages as m')
            ->leftJoin('chat_read_states as crs', function ($join) use ($user) {
                $join->on('crs.chat_id', '=', 'm.chat_id')
                     ->where('crs.user_id', '=', $user->id);
            })
            ->whereIn('m.chat_id', $chatIds)
            ->where(function ($q) use ($user) {
                // Exclude own messages; keep NULL sender (system messages).
                $q->where('m.sender_id', '!=', $user->id)
                  ->orWhereNull('m.sender_id');
            })
            ->whereNull('m.deleted_at')
            ->where(function ($q) {
                // Message is unread when it is newer than the last-read position.
                // Case A: last_read_message_id is set → compare by ID.
                $q->where(function ($inner) {
                    $inner->whereNotNull('crs.last_read_message_id')
                          ->whereColumn('m.id', '>', 'crs.last_read_message_id');
                })
                // Case B: no last_read_message_id, but read_at timestamp is set → compare by created_at.
                ->orWhere(function ($inner) {
                    $inner->whereNull('crs.last_read_message_id')
                          ->whereNotNull('crs.read_at')
                          ->whereColumn('m.created_at', '>', 'crs.read_at');
                })
                // Case C: no read state row exists OR read state row has null values → all messages unread.
                ->orWhereNull('crs.chat_id')
                ->orWhere(function ($inner) {
                    $inner->whereNull('crs.last_read_message_id')
                          ->whereNull('crs.read_at');
                });
            })
            ->count();

        return max(0, (int) $count);
    }

    /**
     * Count incomplete tasks assigned to the given user.
     */
    public function myTasksCount(User $user): int
    {
        return Task::query()
            ->whereHas('activity.project')
            ->where(function ($q) use ($user) {
                $q->where('assigned_to', $user->id)
                  ->orWhereHas('assignees', fn ($uq) => $uq->where('user_id', $user->id));
            })
            ->where('status', '!=', Task::STATUS_COMPLETED)
            ->count();
    }

    /**
     * Return the user's primary system role (memoised per request).
     */
    public function primaryRole(User $user): string
    {
        return $this->authService->getPrimaryRole($user);
    }

    /**
     * Return all roles held by the user (memoised per request).
     *
     * @return string[]
     */
    public function userRoles(User $user): array
    {
        return $this->authService->getUserRoles($user);
    }

    /**
     * Count active (non-completed) projects the user is involved in.
     */
    public function activeProjectsCount(User $user): int
    {
        return Project::query()
            ->where(function ($q) use ($user) {
                $q->where('created_by', $user->id)
                  ->orWhereHas('roleAssignments', fn ($rq) => $rq->where('user_id', $user->id));
            })
            ->where('status', '!=', Project::STATUS_COMPLETED)
            ->count();
    }

    /**
     * Count tasks under review in committees where the user is a Chairperson or
     * Overall Chair, so they know how many deliverables need their attention.
     */
    public function pendingReviewsCount(User $user): int
    {
        return Task::query()
            ->where('status', Task::STATUS_UNDER_REVIEW)
            ->whereHas('activity.committee', function ($q) use ($user) {
                $q->whereHas('roleAssignments', fn ($rq) =>
                      $rq->where('user_id', $user->id)
                         ->where('role', ProjectRoleAssignment::ROLE_PROJECT_STAFF)
                  )
                  ->orWhereHas('project', fn ($pq) =>
                      $pq->where('created_by', $user->id)
                         ->orWhereHas('roleAssignments', fn ($rq) =>
                             $rq->where('user_id', $user->id)
                                ->where('role', ProjectRoleAssignment::ROLE_PROJECT_LEADER)
                         )
                  );
            })
            ->count();
    }

    /**
     * Return list of available verified users (excluding the current user).
     *
     * Cached for 60 seconds across requests, and memoized per-request via once().
     * This avoids scanning the full users table on every Inertia page navigation,
     * while preserving 100% data contract compatibility for CreateProjectModal,
     * CreateCommitteeModal, and Project Show pages.
     *
     * @return array<int, array{id: int, name: string, email: string}>
     */
    public function availableUsers(User $user): array
    {
        return once(function () use ($user) {
            $all = \Illuminate\Support\Facades\Cache::remember('verified_users_summary', 60, function () {
                return User::query()
                    ->whereNotNull('email_verified_at')
                    ->select(['id', 'name', 'email'])
                    ->orderBy('name')
                    ->get()
                    ->map(fn ($u) => [
                        'id' => (int) $u->id,
                        'name' => (string) $u->name,
                        'email' => (string) $u->email,
                    ])
                    ->all();
            });

            return array_values(array_filter($all, fn ($u) => $u['id'] !== (int) $user->id));
        });
    }
}
