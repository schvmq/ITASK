<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Activity extends Model
{
    use HasFactory;

    public const STATUS_TO_DO = 'To Do';
    public const STATUS_IN_PROGRESS = 'In Progress';
    public const STATUS_UNDER_REVIEW = 'Under Review';
    public const STATUS_RETURNED_FOR_REVISION = 'Returned for Revision';
    public const STATUS_COMPLETED = 'Completed';

    public const STATUSES = [
        self::STATUS_TO_DO,
        self::STATUS_IN_PROGRESS,
        self::STATUS_UNDER_REVIEW,
        self::STATUS_RETURNED_FOR_REVISION,
        self::STATUS_COMPLETED,
    ];

    protected $fillable = [
        'project_id',
        'committee_id',
        'created_by',
        'title',
        'description',
        'status',
        'due_date',
        'submission_notes',
        'review_feedback',
        'reviewed_by',
        'reviewed_at',
    ];

    protected function casts(): array
    {
        return [
            'due_date' => 'date',
            'reviewed_at' => 'datetime',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function committee(): BelongsTo
    {
        return $this->belongsTo(Committee::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(Task::class);
    }
}
