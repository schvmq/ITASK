<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Skill extends Model
{
    use HasFactory;

    protected $fillable = [
        'category_id',
        'code',
        'name',
        'statement',
        'display_order',
    ];

    protected function casts(): array
    {
        return [
            'category_id' => 'integer',
            'display_order' => 'integer',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(SkillCategory::class, 'category_id');
    }

    public function ratings(): HasMany
    {
        return $this->hasMany(UserSkillRating::class, 'skill_id');
    }

    public function deliverableRequirements(): HasMany
    {
        return $this->hasMany(DeliverableSkillRequirement::class, 'skill_id');
    }

    public function taskRequirements(): HasMany
    {
        return $this->hasMany(TaskSkillRequirement::class, 'skill_id');
    }
}
