<?php

namespace App\Events;

use App\Models\Message;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MessageSent implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public Message $message)
    {
        // Safely load relationships if needed
        $this->message->loadMissing(['sender:id,name,email', 'task.assignees:id,name', 'task.assignee:id,name']);
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, \Illuminate\Broadcasting\Channel>
     */
    public function broadcastOn(): array
    {
        $chatId = $this->message->chat_id ?? $this->message->conversation_id;

        return [
            new PrivateChannel('chat.' . $chatId),
        ];
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'MessageSent';
    }

    /**
     * Data to broadcast with the event.
     *
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        $chatId = $this->message->chat_id ?? $this->message->conversation_id;

        $taskData = null;
        if ($this->message->task) {
            $t = $this->message->task;
            $assignees = $t->assignees->isNotEmpty()
                ? $t->assignees->map(fn ($u) => ['id' => $u->id, 'name' => $u->name])->values()
                : ($t->assignee ? [['id' => $t->assignee->id, 'name' => $t->assignee->name]] : []);

            $taskData = [
                'id' => $t->id,
                'title' => $t->title,
                'description' => $t->description,
                'status' => $t->status,
                'priority' => $t->priority ?? 'Medium',
                'due_date' => $t->due_date ? $t->due_date->format('M d, Y') : null,
                'assignees' => $assignees,
            ];
        }

        return [
            'id' => $this->message->id,
            'chat_id' => $chatId,
            'conversation_id' => $chatId,
            'sender_id' => $this->message->sender_id,
            'type' => $this->message->type ?? ($this->message->sender_id === null ? 'system' : 'text'),
            'body' => $this->message->body ?? '',
            'task_id' => $this->message->task_id,
            'task' => $taskData,
            'attachment_path' => $this->message->attachment_path,
            'attachment_name' => $this->message->attachment_name,
            'attachment_type' => $this->message->attachment_type,
            'attachment_size' => $this->message->attachment_size,
            'created_at' => $this->message->created_at->toISOString(),
            'sender' => $this->message->sender ? [
                'id' => $this->message->sender->id,
                'name' => $this->message->sender->name,
                'email' => $this->message->sender->email,
            ] : null,
        ];
    }
}
