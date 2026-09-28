<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Task extends Model
{
    use HasFactory;

    public const STATUS_TO_DO = 'To Do';
    public const STATUS_TODO = self::STATUS_TO_DO;
    public const STATUS_IN_PROGRESS = 'In Progress';
    public const STATUS_UNDER_REVIEW = 'Under Review';
    public const STATUS_RETURNED = 'Returned';
    public const STATUS_COMPLETED = 'Completed';

    public const STATUSES = [
        self::STATUS_TO_DO,
        self::STATUS_IN_PROGRESS,
        self::STATUS_UNDER_REVIEW,
        self::STATUS_RETURNED,
        self::STATUS_COMPLETED,
    ];

    protected $fillable = [
        'activity_id',
        'assigned_to',
        'title',
        'description',
        'status',
        'due_date',
        'requires_review',
    ];

    protected function casts(): array
    {
        return [
            'due_date' => 'date',
            'requires_review' => 'boolean',
        ];
    }

    public function activity(): BelongsTo
    {
        return $this->belongsTo(Activity::class);
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function checklistItems(): HasMany
    {
        return $this->hasMany(ChecklistItem::class)->orderBy('order')->orderBy('id');
    }

    public function evidences(): HasMany
    {
        return $this->hasMany(TaskEvidence::class);
    }
}
