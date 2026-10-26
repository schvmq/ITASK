<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Message extends Model
{
    use HasFactory, SoftDeletes;

    public const TYPE_TEXT = 'text';
    public const TYPE_TASK = 'task';
    public const TYPE_SYSTEM = 'system';
    public const TYPE_FILE = 'file';

    protected $fillable = [
        'chat_id',
        'sender_id',
        'type',
        'task_id',
        'body',
        'attachment_path',
        'attachment_name',
        'attachment_type',
        'attachment_size',
        'edited_at',
    ];

    protected function casts(): array
    {
        return [
            'attachment_size' => 'integer',
            'edited_at' => 'datetime',
            'deleted_at' => 'datetime',
        ];
    }

    public function chat(): BelongsTo
    {
        return $this->belongsTo(Chat::class);
    }

    /**
     * Backward-compatible alias for chat.
     */
    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Chat::class, 'chat_id');
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_id');
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class);
    }

    public function isSystem(): bool
    {
        return $this->type === self::TYPE_SYSTEM || $this->sender_id === null;
    }
}
