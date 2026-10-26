<?php

namespace App\Policies;

use App\Models\Project;
use App\Models\User;
use App\Services\Authorization\AuthorizationService;

class ProjectPolicy
{
    public function __construct(
        protected AuthorizationService $authService = new AuthorizationService()
    ) {}

    /**
     * Determine whether the user can create projects.
     */
    public function create(User $user): bool
    {
        return $this->authService->canCreateProject($user);
    }

    /**
     * Determine whether the user can view the project.
     */
    public function view(User $user, Project $project): bool
    {
        return $this->authService->canViewProject($user, $project);
    }

    /**
     * Determine whether the user can update the project.
     */
    public function update(User $user, Project $project): bool
    {
        return $this->authService->canUpdateProject($user, $project);
    }

    /**
     * Determine whether the user can archive the project.
     */
    public function archive(User $user, Project $project): bool
    {
        return $this->authService->canArchiveProject($user, $project);
    }

    /**
     * Determine whether the user can download the project's approval document.
     */
    public function downloadDocument(User $user, Project $project): bool
    {
        return $this->view($user, $project);
    }

    /**
     * Determine whether the user can upload an additional approval document to the project.
     */
    public function uploadDocument(User $user, Project $project): bool
    {
        return $this->update($user, $project);
    }
}
