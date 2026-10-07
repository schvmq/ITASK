<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ChatUserPreference extends Model
{
    use HasFactory;

    protected $fillable = [
        'chat_id',
        'user_id',
        'is_pinned',
        'is_muted',
    ];

    protected function casts(): array
    {
        return [
            'is_pinned' => 'boolean',
            'is_muted' => 'boolean',
        ];
    }

    public function chat(): BelongsTo
    {
        return $this->belongsTo(Chat::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
