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
            'unread_messages_count' => $request->user() ? \App\Models\ConversationParticipant::query()
                ->where('user_id', $request->user()->id)
                ->whereHas('conversation.messages', function ($q) use ($request) {
                    $q->where('sender_id', '!=', $request->user()->id);
                })
                ->get()
                ->filter(function ($p) use ($request) {
                    return $p->conversation->messages()
                        ->where('sender_id', '!=', $request->user()->id)
                        ->when($p->last_read_message_id, fn ($q) => $q->where('id', '>', $p->last_read_message_id))
                        ->when(! $p->last_read_message_id && $p->last_read_at, fn ($q) => $q->where('created_at', '>', $p->last_read_at))
                        ->exists();
                })
                ->count() : 0,
            'my_tasks_count' => $request->user() ? \App\Models\Task::query()
                ->where(function ($q) use ($request) {
                    $q->where('assigned_to', $request->user()->id)
                      ->orWhereHas('assignees', fn ($uq) => $uq->where('user_id', $request->user()->id));
                })
                ->where('status', '!=', \App\Models\Task::STATUS_COMPLETED)
                ->count() : 0,
        ];
    }
}
