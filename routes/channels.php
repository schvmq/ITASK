<?php

use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('App.Models.User.{id}', function (User $user, $id) {
    return (int) $user->id === (int) $id;
});

Broadcast::channel('user.{id}', function (User $user, $id) {
    return (int) $user->id === (int) $id;
});

Broadcast::channel('chat.{chatId}', function (User $user, int $chatId) {
    $chat = \App\Models\Chat::with('project')->find($chatId)
        ?: \App\Models\Chat::with('project')->where('project_id', $chatId)->first();
    if (! $chat || ! $chat->project || $chat->trashed() || $chat->project->trashed()) {
        return false;
    }

    if (! $chat->hasActiveMember((int) $user->id)) {
        return false;
    }

    return [
        'id' => (int) $user->id,
        'name' => $user->name,
    ];
});
