<?php

namespace App\Events;

use App\Models\Message;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MessageRestored implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public Message $message)
    {
        $this->message->loadMissing('sender:id,name,email');
    }

    public function broadcastOn(): array
    {
        $chatId = $this->message->chat_id ?? $this->message->conversation_id;

        return [
            new PrivateChannel('chat.' . $chatId),
        ];
    }

    public function broadcastAs(): string
    {
        return 'MessageRestored';
    }

    public function broadcastWith(): array
    {
        $chatId = $this->message->chat_id ?? $this->message->conversation_id;

        return [
            'id' => $this->message->id,
            'chat_id' => $chatId,
            'conversation_id' => $chatId,
            'sender_id' => $this->message->sender_id,
            'body' => $this->message->body,
            'is_deleted' => false,
            'created_at' => $this->message->created_at->toISOString(),
            'sender' => $this->message->sender ? [
                'id' => $this->message->sender->id,
                'name' => $this->message->sender->name,
                'email' => $this->message->sender->email,
            ] : null,
        ];
    }
}
