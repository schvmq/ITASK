<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DeliverableSkillRequirement extends Model
{
    use HasFactory;

    protected $fillable = [
        'activity_id',
        'skill_id',
        'minimum_rating',
    ];

    protected function casts(): array
    {
        return [
            'activity_id' => 'integer',
            'skill_id' => 'integer',
            'minimum_rating' => 'integer',
        ];
    }

    public function activity(): BelongsTo
    {
        return $this->belongsTo(Activity::class, 'activity_id');
    }

    public function skill(): BelongsTo
    {
        return $this->belongsTo(Skill::class, 'skill_id');
    }
}
