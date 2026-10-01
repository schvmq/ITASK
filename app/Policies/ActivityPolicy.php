<?php

namespace App\Policies;

use App\Models\Activity;
use App\Models\Committee;
use App\Models\ProjectRoleAssignment;
use App\Models\User;

class ActivityPolicy
{
    /**
     * Determine whether the user can view the activity.
     * Allowed for:
     * - Project Leader of the project
     * - Project Staff assigned to this committee
     * - Project Member assigned to this committee
     */
    public function view(User $user, Activity $activity): bool
    {
        $project = $activity->project;
        $committee = $activity->committee;

        // 1. Project Leader has project-level oversight
        $isLeader = $project->roleAssignments()
            ->where('user_id', $user->id)
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_LEADER)
            ->exists();

        if ($isLeader) {
            return true;
        }

        // 2. Project Staff or Project Member assigned to this committee
        return $committee->roleAssignments()
            ->where('user_id', $user->id)
            ->exists();
    }

    /**
     * Determine whether the user can create an activity within the committee.
     * Allowed for:
     * - Project Leader of the parent project (project-level authority)
     * - Project Staff assigned to this specific committee
     */
    public function create(User $user, Committee $committee): bool
    {
        $project = $committee->project;

        // Project Leader can create activities in any committee within their project
        $isLeader = $project->roleAssignments()
            ->where('user_id', $user->id)
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_LEADER)
            ->exists();

        if ($isLeader) {
            return true;
        }

        // Project Staff assigned to this specific committee
        return $committee->roleAssignments()
            ->where('user_id', $user->id)
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_STAFF)
            ->exists();
    }

    /**
     * Determine whether the user can update the activity.
     * Allowed for:
     * - Project Leader of the parent project
     * - Project Staff assigned to this committee
     */
    public function update(User $user, Activity $activity): bool
    {
        $project = $activity->committee->project;

        $isLeader = $project->roleAssignments()
            ->where('user_id', $user->id)
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_LEADER)
            ->exists();

        if ($isLeader) {
            return true;
        }

        return $activity->committee->roleAssignments()
            ->where('user_id', $user->id)
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_STAFF)
            ->exists();
    }

    /**
     * Determine whether the user can delete the activity.
     * Allowed for:
     * - Project Leader of the parent project
     * - Project Staff assigned to this committee
     */
    public function delete(User $user, Activity $activity): bool
    {
        $project = $activity->committee->project;

        $isLeader = $project->roleAssignments()
            ->where('user_id', $user->id)
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_LEADER)
            ->exists();

        if ($isLeader) {
            return true;
        }

        return $activity->committee->roleAssignments()
            ->where('user_id', $user->id)
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_STAFF)
            ->exists();
    }

    /**
     * Determine whether the user can submit the activity for review.
     * Allowed only for an authorized Project Member assigned to this committee
     * who is assigned relevant work (at least one task) under this activity.
     */
    public function submit(User $user, Activity $activity): bool
    {
        // 1. Must be assigned as Project Member in this committee
        $isMember = $activity->committee->roleAssignments()
            ->where('user_id', $user->id)
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_MEMBER)
            ->exists();

        if (! $isMember) {
            return false;
        }

        // 2. Must be actually assigned relevant work under this activity
        return $activity->tasks()
            ->where('assigned_to', $user->id)
            ->exists();
    }

    /**
     * Determine whether the user can review the activity.
     * Allowed only for the Project Staff who heads this committee.
     */
    public function review(User $user, Activity $activity): bool
    {
        return $activity->committee->roleAssignments()
            ->where('user_id', $user->id)
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_STAFF)
            ->exists();
    }

    /**
     * Determine whether the user can send a manual reminder for the activity.
     * Allowed for:
     * - Project Leader of the parent project
     * - Project Staff assigned to this committee
     */
    public function sendReminder(User $user, Activity $activity): bool
    {
        $project = $activity->project ?? $activity->committee?->project;

        if ($project) {
            $isLeader = $project->roleAssignments()
                ->where('user_id', $user->id)
                ->where('role', ProjectRoleAssignment::ROLE_PROJECT_LEADER)
                ->exists();

            if ($isLeader) {
                return true;
            }
        }

        return $activity->committee?->roleAssignments()
            ->where('user_id', $user->id)
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_STAFF)
            ->exists() ?? false;
    }
}
