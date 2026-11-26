<?php

namespace App\Services\Skills;

use App\Models\Skill;
use App\Models\SkillCategory;
use App\Models\User;
use App\Models\UserSkillRating;
use Illuminate\Support\Facades\DB;

class SkillProfileService
{
    /**
     * Retrieve the standardized catalog along with the user's current ratings and completion status.
     */
    public function getProfileData(User $user): array
    {
        $categories = SkillCategory::with(['skills' => fn ($q) => $q->orderBy('display_order')])
            ->orderBy('display_order')
            ->get();

        $userRatings = $user->skillRatings->keyBy('skill_id');
        $totalSkills = Skill::count();
        $isCatalogValid = ($totalSkills === 18);
        $ratedCount = UserSkillRating::where('user_id', $user->id)
            ->whereIn('skill_id', Skill::select('id'))
            ->count();

        $formattedCategories = $categories->map(function (SkillCategory $category) use ($userRatings) {
            return [
                'id' => $category->id,
                'name' => $category->name,
                'display_order' => $category->display_order,
                'skills' => $category->skills->map(function (Skill $skill) use ($userRatings) {
                    $userRating = $userRatings->get($skill->id);
                    return [
                        'id' => $skill->id,
                        'category_id' => $skill->category_id,
                        'code' => $skill->code,
                        'name' => $skill->name,
                        'statement' => $skill->statement,
                        'display_order' => $skill->display_order,
                        'user_rating' => $userRating !== null ? (int) $userRating->rating : null,
                    ];
                })->values()->all(),
            ];
        })->values()->all();

        $isCompleted = ($isCatalogValid && $ratedCount >= 18);

        return [
            'categories' => $formattedCategories,
            'total_skills' => $totalSkills,
            'rated_count' => $ratedCount,
            'is_completed' => $isCompleted,
            'is_acknowledged' => $user->hasAcknowledgedSkillOnboarding(),
            'skill_onboarding_acknowledged_at' => $user->skill_onboarding_acknowledged_at?->toIso8601String(),
            'skill_assessment_completed_at' => $user->skill_assessment_completed_at?->toIso8601String(),
        ];
    }

    /**
     * Update user skill ratings partially or fully and recalculate completion status.
     *
     * @param User $user
     * @param array $ratings Array of items: ['skill_id' => int, 'rating' => ?int]
     * @return array Updated profile data summary
     */
    public function updateRatings(User $user, array $ratings): array
    {
        return DB::transaction(function () use ($user, $ratings) {
            // Lock user record for update to prevent concurrent race conditions
            $lockedUser = User::where('id', $user->id)->lockForUpdate()->first();

            foreach ($ratings as $item) {
                $skillId = (int) $item['skill_id'];
                $ratingValue = $item['rating'] ?? null;

                if ($ratingValue === null) {
                    // Explicitly clearing a rating back to Unrated
                    UserSkillRating::where('user_id', $lockedUser->id)
                        ->where('skill_id', $skillId)
                        ->delete();
                } else {
                    // Rating between 0 and 4
                    UserSkillRating::updateOrCreate(
                        [
                            'user_id' => $lockedUser->id,
                            'skill_id' => $skillId,
                        ],
                        [
                            'rating' => (int) $ratingValue,
                        ]
                    );
                }
            }

            // Standardized catalog must contain exactly 18 skills to be complete
            $totalSkills = Skill::count();
            $hasCompleteCatalog = ($totalSkills === 18);

            // Count persisted ratings that belong to valid standardized skills
            $validRatedCount = UserSkillRating::where('user_id', $lockedUser->id)
                ->whereIn('skill_id', Skill::select('id'))
                ->count();

            $isNowComplete = ($hasCompleteCatalog && $validRatedCount === 18);
            $now = now();
            $userUpdates = [];

            // Maintain onboarding acknowledgement if not set
            if ($lockedUser->skill_onboarding_acknowledged_at === null) {
                $userUpdates['skill_onboarding_acknowledged_at'] = $now;
            }

            if ($isNowComplete) {
                // When an incomplete assessment becomes complete, set timestamp.
                // When an already complete assessment remains complete, PRESERVE existing timestamp.
                if ($lockedUser->skill_assessment_completed_at === null) {
                    $userUpdates['skill_assessment_completed_at'] = $now;
                }
            } else {
                // When a rating is cleared and the assessment becomes incomplete, reset timestamp to null.
                if ($lockedUser->skill_assessment_completed_at !== null) {
                    $userUpdates['skill_assessment_completed_at'] = null;
                }
            }

            if (!empty($userUpdates)) {
                $lockedUser->forceFill($userUpdates)->save();
            }

            $user->refresh();

            return $this->getProfileData($lockedUser);
        });
    }

    /**
     * Acknowledge onboarding (e.g. Complete Later), saving any submitted ratings.
     */
    public function acknowledgeOnboarding(User $user, ?array $pendingRatings = null): array
    {
        return DB::transaction(function () use ($user, $pendingRatings) {
            $lockedUser = User::where('id', $user->id)->lockForUpdate()->first();

            if (!empty($pendingRatings)) {
                $this->updateRatings($lockedUser, $pendingRatings);
            }

            if ($lockedUser->skill_onboarding_acknowledged_at === null) {
                $lockedUser->forceFill(['skill_onboarding_acknowledged_at' => now()])->save();
            }

            $user->refresh();

            return $this->getProfileData($lockedUser);
        });
    }
}
