<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'auth' => [
                'user' => $request->user() ? [
                    'id' => $request->user()->id,
                    'name' => $request->user()->name,
                    'email' => $request->user()->email,
                    'email_verified_at' => $request->user()->email_verified_at,
                    'is_admin' => (bool) $request->user()->is_admin,
                ] : null,
            ],
            'flash' => [
                'status' => $request->session()->get('status'),
                'success' => $request->session()->get('success') ?: $request->session()->get('status'),
                'error' => $request->session()->get('error'),
            ],
            'notifications' => [
                'unread_count' => $request->user()?->unreadNotifications()->count() ?? 0,
                'recent' => $request->user() ? $request->user()->notifications()
                    ->latest()
                    ->take(5)
                    ->get()
                    ->map(function ($notif) {
                        return [
                            'id' => $notif->id,
                            'type' => $notif->type,
                            'data' => $notif->data,
                            'read_at' => $notif->read_at?->toISOString(),
                            'created_at' => $notif->created_at?->toISOString(),
                            'created_at_human' => $notif->created_at?->diffForHumans(),
                        ];
                    }) : [],
            ],
            'unread_messages_count' => $request->user() ? (function () use ($request) {
                $user = $request->user();
                $chats = \App\Models\Chat::query()
                    ->whereHas('project', function ($q) use ($user) {
                        $q->whereNull('deleted_at')
                            ->where(function ($pq) use ($user) {
                                $pq->where('created_by', $user->id)
                                    ->orWhereHas('roleAssignments', fn ($rq) => $rq->where('user_id', $user->id));
                            });
                    })
                    ->with('readStates')
                    ->get();

                $total = 0;
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

                    $total += $count;
                }

                return max(0, $total);
            })() : 0,
            'my_tasks_count' => $request->user() ? \App\Models\Task::query()
                ->whereHas('activity.project')
                ->where(function ($q) use ($request) {
                    $q->where('assigned_to', $request->user()->id)
                      ->orWhereHas('assignees', fn ($uq) => $uq->where('user_id', $request->user()->id));
                })
                ->where('status', '!=', \App\Models\Task::STATUS_COMPLETED)
                ->count() : 0,
            'primaryRole' => $request->user() ? (function () use ($request) {
                $user = $request->user();
                $userId = $user->id;
                $isLeader = \App\Models\Project::where('created_by', $userId)
                    ->orWhereHas('roleAssignments', fn ($q) => $q->where('user_id', $userId)->where('role', \App\Models\ProjectRoleAssignment::ROLE_PROJECT_LEADER))
                    ->exists();
                if ($isLeader) {
                    return \App\Models\ProjectRoleAssignment::ROLE_PROJECT_LEADER;
                }
                $isStaff = \App\Models\ProjectRoleAssignment::where('user_id', $userId)
                    ->where('role', \App\Models\ProjectRoleAssignment::ROLE_PROJECT_STAFF)
                    ->exists();
                if ($isStaff) {
                    return \App\Models\ProjectRoleAssignment::ROLE_PROJECT_STAFF;
                }
                return \App\Models\ProjectRoleAssignment::ROLE_PROJECT_MEMBER;
            })() : null,
            'userRoles' => $request->user() ? (function () use ($request) {
                $user = $request->user();
                $roles = [];
                if (\App\Models\Project::where('created_by', $user->id)->orWhereHas('roleAssignments', fn ($q) => $q->where('user_id', $user->id)->where('role', \App\Models\ProjectRoleAssignment::ROLE_PROJECT_LEADER))->exists()) {
                    $roles[] = \App\Models\ProjectRoleAssignment::ROLE_PROJECT_LEADER;
                }
                if (\App\Models\ProjectRoleAssignment::where('user_id', $user->id)->where('role', \App\Models\ProjectRoleAssignment::ROLE_PROJECT_STAFF)->exists()) {
                    $roles[] = \App\Models\ProjectRoleAssignment::ROLE_PROJECT_STAFF;
                }
                if (\App\Models\ProjectRoleAssignment::where('user_id', $user->id)->where('role', \App\Models\ProjectRoleAssignment::ROLE_PROJECT_MEMBER)->exists()) {
                    $roles[] = \App\Models\ProjectRoleAssignment::ROLE_PROJECT_MEMBER;
                }
                if (empty($roles)) {
                    $roles[] = \App\Models\ProjectRoleAssignment::ROLE_PROJECT_MEMBER;
                }
                return $roles;
            })() : [],
            'active_projects_count' => $request->user() ? \App\Models\Project::query()
                ->where(function ($q) use ($request) {
                    $q->where('created_by', $request->user()->id)
                      ->orWhereHas('roleAssignments', fn ($rq) => $rq->where('user_id', $request->user()->id));
                })
                ->where('status', '!=', \App\Models\Project::STATUS_COMPLETED)
                ->count() : 0,
            'pending_reviews_count' => $request->user() ? (function () use ($request) {
                $user = $request->user();
                return \App\Models\Task::query()
                    ->where('status', \App\Models\Task::STATUS_UNDER_REVIEW)
                    ->whereHas('activity.committee', function ($q) use ($user) {
                        $q->whereHas('roleAssignments', fn ($rq) => $rq->where('user_id', $user->id)->where('role', \App\Models\ProjectRoleAssignment::ROLE_PROJECT_STAFF))
                          ->orWhereHas('project', fn ($pq) => $pq->where('created_by', $user->id)->orWhereHas('roleAssignments', fn ($rq) => $rq->where('user_id', $user->id)->where('role', \App\Models\ProjectRoleAssignment::ROLE_PROJECT_LEADER)));
                    })
                    ->count();
            })() : 0,
            'available_users' => $request->user() ? \App\Models\User::query()
                ->where('id', '!=', $request->user()->id)
                ->whereNotNull('email_verified_at')
                ->select(['id', 'name', 'email'])
                ->orderBy('name')
                ->get()
                ->map(fn ($u) => [
                    'id' => $u->id,
                    'name' => $u->name,
                    'email' => $u->email,
                ])
                ->values()
                ->all() : [],
        ];
    }
}
