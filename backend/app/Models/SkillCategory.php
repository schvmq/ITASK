<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SkillCategory extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'display_order',
    ];

    protected function casts(): array
    {
        return [
            'display_order' => 'integer',
        ];
    }

    public function skills(): HasMany
    {
        return $this->hasMany(Skill::class, 'category_id')->orderBy('display_order');
    }
}
