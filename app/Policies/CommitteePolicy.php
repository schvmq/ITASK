<?php

namespace App\Policies;

use App\Models\Committee;
use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Models\User;

class CommitteePolicy
{
    /**
     * Determine whether the user can view the committee.
     * Allowed for: Project Leader of the parent project, or Staff/Member assigned to this committee.
     */
    public function view(User $user, Committee $committee): bool
    {
        $project = $committee->project;

        // 1. Project Leader of the project can view all committees
        $isLeader = $project->roleAssignments()
            ->where('user_id', $user->id)
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_LEADER)
            ->exists();

        if ($isLeader) {
            return true;
        }

        // 2. Staff or Member assigned to THIS specific committee
        return $committee->roleAssignments()
            ->where('user_id', $user->id)
            ->exists();
    }

    /**
     * Determine whether the user can create a committee within the project.
     * Allowed only for: Project Leader of this project.
     */
    public function create(User $user, Project $project): bool
    {
        return $project->roleAssignments()
            ->where('user_id', $user->id)
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_LEADER)
            ->exists();
    }

    /**
     * Determine whether the user can update the committee.
     * Allowed only for: Project Leader of this project.
     */
    public function update(User $user, Committee $committee): bool
    {
        return $committee->project->roleAssignments()
            ->where('user_id', $user->id)
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_LEADER)
            ->exists();
    }

    /**
     * Determine whether the user can delete/archive the committee.
     * Allowed only for: Project Leader of this project.
     */
    public function delete(User $user, Committee $committee): bool
    {
        return $committee->project->roleAssignments()
            ->where('user_id', $user->id)
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_LEADER)
            ->exists();
    }

    /**
     * Determine whether the user can assign or remove members for this committee.
     * Allowed only for: Project Leader of this project.
     */
    public function manageMembers(User $user, Committee $committee): bool
    {
        return $committee->project->roleAssignments()
            ->where('user_id', $user->id)
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_LEADER)
            ->exists();
    }
}
