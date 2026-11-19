<?php

namespace App\Http\Middleware;

use App\Services\SharedPropsService;
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

    public function __construct(private readonly SharedPropsService $sharedProps) {}

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
     * Performance notes
     * -----------------
     * - `available_users` is intentionally absent.  It is now served by
     *   GET /api/users/available and fetched lazily by components that need it.
     * - `unread_messages_count` uses a single aggregated SQL query (N+1 removed).
     * - `primaryRole` and `userRoles` are memoised inside AuthorizationService
     *   via once(), so controller/policy calls within the same request are free.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $user = $request->user();

        return [
            ...parent::share($request),
            'auth' => [
                'user' => $user ? [
                    'id'                => $user->id,
                    'name'              => $user->name,
                    'email'             => $user->email,
                    'email_verified_at' => $user->email_verified_at,
                    'is_admin'          => (bool) $user->is_admin,
                ] : null,
            ],
            'flash' => [
                'status'  => $request->session()->get('status'),
                'success' => $request->session()->get('success') ?: $request->session()->get('status'),
                'error'   => $request->session()->get('error'),
            ],
            'notifications' => $user ? [
                'unread_count' => $this->sharedProps->unreadNotificationCount($user),
                'recent'       => $this->sharedProps->recentNotifications($user),
            ] : ['unread_count' => 0, 'recent' => []],
            'unread_messages_count'  => $user ? $this->sharedProps->unreadMessageCount($user)  : 0,
            'my_tasks_count'         => $user ? $this->sharedProps->myTasksCount($user)         : 0,
            'primaryRole'            => $user ? $this->sharedProps->primaryRole($user)           : null,
            'userRoles'              => $user ? $this->sharedProps->userRoles($user)             : [],
            'active_projects_count'  => $user ? $this->sharedProps->activeProjectsCount($user)  : 0,
            'pending_reviews_count'  => $user ? $this->sharedProps->pendingReviewsCount($user)  : 0,
            'available_users'        => fn () => $user ? $this->sharedProps->availableUsers($user) : [],
        ];
    }
}
