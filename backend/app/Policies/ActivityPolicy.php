<?php

namespace App\Policies;

use App\Models\Activity;
use App\Models\Committee;
use App\Models\User;
use App\Services\Authorization\AuthorizationService;

class ActivityPolicy
{
    public function __construct(
        protected AuthorizationService $authService = new AuthorizationService()
    ) {}

    /**
     * Determine whether the user can view the activity.
     */
    public function view(User $user, Activity $activity): bool
    {
        return $this->authService->canViewActivity($user, $activity);
    }

    /**
     * Determine whether the user can create an activity within the committee.
     */
    public function create(User $user, Committee $committee): bool
    {
        return $this->authService->canCreateActivity($user, $committee);
    }

    /**
     * Determine whether the user can update the activity.
     */
    public function update(User $user, Activity $activity): bool
    {
        return $this->authService->canManageActivity($user, $activity);
    }

    /**
     * Determine whether the user can delete the activity.
     */
    public function delete(User $user, Activity $activity): bool
    {
        return $this->authService->canManageActivity($user, $activity);
    }

    /**
     * Determine whether the user can submit the activity for review.
     */
    public function submit(User $user, Activity $activity): bool
    {
        return $this->authService->canSubmitActivity($user, $activity);
    }

    /**
     * Determine whether the user can review the activity.
     */
    public function review(User $user, Activity $activity): bool
    {
        return $this->authService->canReviewActivity($user, $activity);
    }

    /**
     * Determine whether the user can send a manual reminder for the activity.
     */
    public function sendReminder(User $user, Activity $activity): bool
    {
        return $this->authService->canSendActivityReminder($user, $activity);
    }
}
