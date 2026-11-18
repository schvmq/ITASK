<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CoChairDesignation extends Model
{
    use HasFactory;

    protected $table = 'co_chair_designations';

    protected $fillable = [
        'project_id',
        'user_id',
        'committee_id',
        'designated_by',
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

    public function designatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'designated_by');
    }

    public function isEventLevel(): bool
    {
        return is_null($this->committee_id);
    }

    public function isCommitteeLevel(): bool
    {
        return ! is_null($this->committee_id);
    }

    public function scopeEventLevel(Builder $query): Builder
    {
        return $query->whereNull('committee_id');
    }

    public function scopeCommitteeLevel(Builder $query, ?int $committeeId = null): Builder
    {
        $query->whereNotNull('committee_id');
        if ($committeeId !== null) {
            $query->where('committee_id', $committeeId);
        }

        return $query;
    }
}
