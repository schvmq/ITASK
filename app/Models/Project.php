<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Project extends Model
{
    use HasFactory;

    public const STATUS_PLANNING = 'Planning';
    public const STATUS_ACTIVE = 'Active';
    public const STATUS_COMPLETED = 'Completed';
    public const STATUS_ARCHIVED = 'Archived';

    public const STATUSES = [
        self::STATUS_PLANNING,
        self::STATUS_ACTIVE,
        self::STATUS_COMPLETED,
        self::STATUS_ARCHIVED,
    ];

    protected $fillable = [
        'title',
        'description',
        'status',
        'created_by',
        'start_date',
        'end_date',
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function roleAssignments(): HasMany
    {
        return $this->hasMany(ProjectRoleAssignment::class);
    }

    public function committees(): HasMany
    {
        return $this->hasMany(Committee::class);
    }

    public function activities(): HasMany
    {
        return $this->hasMany(Activity::class);
    }

    public function approvalDocuments(): HasMany
    {
        return $this->hasMany(ProjectApprovalDocument::class);
    }

    public function leaderAssignment(): HasOne
    {
        return $this->hasOne(ProjectRoleAssignment::class)
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_LEADER);
    }
}
