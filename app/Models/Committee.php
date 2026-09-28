<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Committee extends Model
{
    use HasFactory;

    protected $fillable = [
        'project_id',
        'name',
        'description',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function roleAssignments(): HasMany
    {
        return $this->hasMany(ProjectRoleAssignment::class);
    }

    public function staffAssignment(): HasOne
    {
        return $this->hasOne(ProjectRoleAssignment::class)
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_STAFF);
    }

    public function memberAssignments(): HasMany
    {
        return $this->hasMany(ProjectRoleAssignment::class)
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_MEMBER);
    }

    public function activities(): HasMany
    {
        return $this->hasMany(Activity::class);
    }
}
