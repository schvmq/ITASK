<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MemberResume extends Model
{
    use HasFactory;

    protected $table = 'member_resumes';

    protected $fillable = [
        'user_id',
        'original_name',
        'file_path',
        'file_size',
        'mime_type',
        'extracted_text',
        'extracted_skills',
        'certifications',
        'experience_summary',
        'eligibility_status',
        'raw_ai_analysis',
        'strengths_assessment',
        'preferred_task_categories',
        'leadership_readiness',
        'availability_hours',
        'deliberation_notes',
        'assessment_completed_at',
    ];

    protected function casts(): array
    {
        return [
            'file_size' => 'integer',
            'extracted_skills' => 'array',
            'certifications' => 'array',
            'raw_ai_analysis' => 'array',
            'strengths_assessment' => 'array',
            'preferred_task_categories' => 'array',
            'assessment_completed_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}

