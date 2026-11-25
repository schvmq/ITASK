<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TaskSkillRequirement extends Model
{
    use HasFactory;

    protected $fillable = [
        'task_id',
        'skill_id',
        'minimum_rating',
    ];

    protected function casts(): array
    {
        return [
            'task_id' => 'integer',
            'skill_id' => 'integer',
            'minimum_rating' => 'integer',
        ];
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class, 'task_id');
    }

    public function skill(): BelongsTo
    {
        return $this->belongsTo(Skill::class, 'skill_id');
    }
}
