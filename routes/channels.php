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
    $chat = \App\Models\Chat::with('project')->find($chatId);
    if (! $chat || ! $chat->project || $chat->trashed() || $chat->project->trashed()) {
        return false;
    }

    return $chat->hasActiveMember((int) $user->id);
});
