<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Contracts\Auth\MustVerifyEmail;

class User extends Authenticatable implements MustVerifyEmail
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'is_admin',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_admin' => 'boolean',
            'skill_onboarding_acknowledged_at' => 'datetime',
            'skill_assessment_completed_at' => 'datetime',
        ];
    }

    public function isAdmin(): bool
    {
        return (bool) $this->is_admin;
    }

    public function createdProjects(): HasMany
    {
        return $this->hasMany(Project::class, 'created_by');
    }

    public function projectRoleAssignments(): HasMany
    {
        return $this->hasMany(ProjectRoleAssignment::class);
    }

    public function assignedTasks(): HasMany
    {
        return $this->hasMany(Task::class, 'assigned_to');
    }

    public function createdActivities(): HasMany
    {
        return $this->hasMany(Activity::class, 'created_by');
    }

    public function taskEvidences(): HasMany
    {
        return $this->hasMany(TaskEvidence::class, 'uploaded_by');
    }

    public function projectApprovalDocuments(): HasMany
    {
        return $this->hasMany(ProjectApprovalDocument::class, 'uploaded_by');
    }

    public function coChairDesignations(): HasMany
    {
        return $this->hasMany(CoChairDesignation::class);
    }

    public function chats()
    {
        return Chat::query()
            ->whereHas('project', function ($q) {
                $q->whereNull('deleted_at')
                    ->where(function ($pq) {
                        $pq->where('created_by', $this->id)
                            ->orWhereHas('roleAssignments', fn ($rq) => $rq->where('user_id', $this->id));
                    });
            });
    }

    public function chatReadStates(): HasMany
    {
        return $this->hasMany(ChatReadState::class);
    }

    public function chatUserPreferences(): HasMany
    {
        return $this->hasMany(ChatUserPreference::class);
    }

    public function conversations()
    {
        return $this->chats();
    }

    public function sentMessages(): HasMany
    {
        return $this->hasMany(Message::class, 'sender_id');
    }

    public function resume(): HasOne
    {
        return $this->hasOne(MemberResume::class);
    }

    public function skillRatings(): HasMany
    {
        return $this->hasMany(UserSkillRating::class);
    }

    public function skills(): BelongsToMany
    {
        return $this->belongsToMany(Skill::class, 'user_skill_ratings')
            ->withPivot('rating')
            ->withTimestamps();
    }

    public function hasAcknowledgedSkillOnboarding(): bool
    {
        return $this->skill_onboarding_acknowledged_at !== null;
    }

    public function hasCompletedSkillAssessment(): bool
    {
        return $this->skill_assessment_completed_at !== null;
    }
}
