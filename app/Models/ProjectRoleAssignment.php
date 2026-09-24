<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProjectRoleAssignment extends Model
{
    use HasFactory;

    public const ROLE_PROJECT_LEADER = 'Project Leader';
    public const ROLE_PROJECT_STAFF = 'Project Staff';
    public const ROLE_PROJECT_MEMBER = 'Project Member';

    public const ROLES = [
        self::ROLE_PROJECT_LEADER,
        self::ROLE_PROJECT_STAFF,
        self::ROLE_PROJECT_MEMBER,
    ];

    protected $fillable = [
        'project_id',
        'user_id',
        'committee_id',
        'role',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function committee(): BelongsTo
    {
        return $this->belongsTo(Committee::class);
    }

    public function isLeader(): bool
    {
        return $this->role === self::ROLE_PROJECT_LEADER;
    }

    public function isStaff(): bool
    {
        return $this->role === self::ROLE_PROJECT_STAFF;
    }

    public function isMember(): bool
    {
        return $this->role === self::ROLE_PROJECT_MEMBER;
    }
}
