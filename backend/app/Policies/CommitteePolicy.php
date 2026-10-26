<?php

namespace App\Policies;

use App\Models\Committee;
use App\Models\Project;
use App\Models\User;
use App\Services\Authorization\AuthorizationService;

class CommitteePolicy
{
    public function __construct(
        protected AuthorizationService $authService = new AuthorizationService()
    ) {}

    /**
     * Determine whether the user can view the committee.
     */
    public function view(User $user, Committee $committee): bool
    {
        return $this->authService->canViewCommittee($user, $committee);
    }

    /**
     * Determine whether the user can create a committee within the project.
     */
    public function create(User $user, Project $project): bool
    {
        return $this->authService->canCreateCommittee($user, $project);
    }

    /**
     * Determine whether the user can update the committee.
     */
    public function update(User $user, Committee $committee): bool
    {
        return $this->authService->canManageCommittee($user, $committee);
    }

    /**
     * Determine whether the user can delete/archive the committee.
     */
    public function delete(User $user, Committee $committee): bool
    {
        return $this->authService->canManageCommittee($user, $committee);
    }

    /**
     * Determine whether the user can assign or remove members for this committee.
     */
    public function manageMembers(User $user, Committee $committee): bool
    {
        return $this->authService->canManageCommittee($user, $committee);
    }
}

