<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Collection;

class Chat extends Model
{
    use HasFactory, SoftDeletes;

    /**
     * Requirement 1.3: New members see full history toggle.
     */
    public const NEW_MEMBERS_SEE_HISTORY = true;

    /**
     * Requirement 1.4: Project retention period in days.
     */
    public const PROJECT_RETENTION_DAYS = 30;

    protected $fillable = [
        'project_id',
        'archived_at',
    ];

    protected function casts(): array
    {
        return [
            'archived_at' => 'datetime',
            'deleted_at' => 'datetime',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(Message::class);
    }

    public function latestMessage(): HasOne
    {
        return $this->hasOne(Message::class)->latestOfMany();
    }

    public function readStates(): HasMany
    {
        return $this->hasMany(ChatReadState::class);
    }

    public function preferences(): HasMany
    {
        return $this->hasMany(ChatUserPreference::class);
    }

    /**
     * Single source of truth: Active project members only.
     * Creator + active role assignments.
     */
    public function hasActiveMember(int $userId): bool
    {
        if (! $this->project_id) {
            return false;
        }

        $project = $this->relationLoaded('project') ? $this->project : $this->project()->first();

        if (! $project || $project->trashed()) {
            return false;
        }

        if ((int) $project->created_by === $userId) {
            return true;
        }

        return $project->roleAssignments()->where('user_id', $userId)->exists();
    }

    /**
     * Check if user is a Project Leader (creator or assigned leader role).
     */
    public function isLeader(int $userId): bool
    {
        $project = $this->relationLoaded('project') ? $this->project : $this->project()->first();

        if (! $project) {
            return false;
        }

        if ((int) $project->created_by === $userId) {
            return true;
        }

        return $project->roleAssignments()
            ->where('user_id', $userId)
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_LEADER)
            ->exists();
    }

    /**
     * Determine if the chat / project is currently archived.
     */
    public function isArchived(): bool
    {
        if ($this->archived_at !== null) {
            return true;
        }

        $project = $this->relationLoaded('project') ? $this->project : $this->project()->first();

        return $project && $project->status === Project::STATUS_ARCHIVED;
    }

    /**
     * Get all active members for this chat derived from project memberships.
     */
    public function getActiveMembers(): Collection
    {
        $project = $this->relationLoaded('project') ? $this->project : $this->project()->first();

        if (! $project) {
            return collect();
        }

        $members = collect();

        if ($project->creator) {
            $members->push($project->creator);
        } else {
            $creator = User::find($project->created_by);
            if ($creator) {
                $members->push($creator);
            }
        }

        $assignedUsers = User::query()
            ->whereIn('id', $project->roleAssignments()->pluck('user_id'))
            ->get();

        foreach ($assignedUsers as $u) {
            $members->push($u);
        }

        return $members->unique('id')->values();
    }
}
