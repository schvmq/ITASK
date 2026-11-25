<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserSkillRating extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'skill_id',
        'rating',
    ];

    protected function casts(): array
    {
        return [
            'user_id' => 'integer',
            'skill_id' => 'integer',
            'rating' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function skill(): BelongsTo
    {
        return $this->belongsTo(Skill::class, 'skill_id');
    }
}
