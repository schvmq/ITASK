<?php

namespace App\Policies;

use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Models\User;

class ProjectPolicy
{
    /**
     * Determine whether the user can view the project.
     * Allowed for: Project Leader, Project Staff, Project Member assigned to the project.
     */
    public function view(User $user, Project $project): bool
    {
        return $project->roleAssignments()
            ->where('user_id', $user->id)
            ->exists();
    }

    /**
     * Determine whether the user can update the project.
     * Allowed only for: Project Leader for this project.
     */
    public function update(User $user, Project $project): bool
    {
        return $project->roleAssignments()
            ->where('user_id', $user->id)
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_LEADER)
            ->exists();
    }

    /**
     * Determine whether the user can archive the project.
     * Allowed only for: Project Leader for this project.
     */
    public function archive(User $user, Project $project): bool
    {
        return $project->roleAssignments()
            ->where('user_id', $user->id)
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_LEADER)
            ->exists();
    }

    /**
     * Determine whether the user can download the project's approval/supporting document.
     * Allowed for: Project Leader, Project Staff, Project Member assigned to the project.
     */
    public function downloadDocument(User $user, Project $project): bool
    {
        return $this->view($user, $project);
    }

    /**
     * Determine whether the user can upload an additional approval document to the project.
     * Allowed only for: Project Leader.
     */
    public function uploadDocument(User $user, Project $project): bool
    {
        return $this->update($user, $project);
    }
}
