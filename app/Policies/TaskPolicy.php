<?php

namespace App\Policies;

use App\Models\Activity;
use App\Models\ProjectRoleAssignment;
use App\Models\Task;
use App\Models\User;

class TaskPolicy
{
    /**
     * Determine whether the user can view the task.
     * Allowed for:
     * - Project Leader of the project
     * - Project Staff assigned to this committee
     * - Project Member assigned to this committee
     */
    public function view(User $user, Task $task): bool
    {
        $activity = $task->activity;
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

        // 2. Staff or Member assigned to this committee
        return $committee->roleAssignments()
            ->where('user_id', $user->id)
            ->exists();
    }

    /**
     * Determine whether the user can create a task under the activity.
     * Allowed for:
     * - Project Leader of the project
     * - Project Staff assigned to this specific committee
     */
    public function create(User $user, Activity $activity): bool
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
     * Determine whether the user can update the task.
     * Allowed for:
     * - Project Leader of the project (full management)
     * - Project Staff who heads this committee (full management)
     * - Assigned Project Member in this committee (status updates only — enforced in UpdateTaskRequest)
     */
    public function update(User $user, Task $task): bool
    {
        $project = $task->activity->committee->project;

        // 1. Project Leader
        $isLeader = $project->roleAssignments()
            ->where('user_id', $user->id)
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_LEADER)
            ->exists();

        if ($isLeader) {
            return true;
        }

        // 2. Project Staff heading this committee
        $isStaff = $task->activity->committee->roleAssignments()
            ->where('user_id', $user->id)
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_STAFF)
            ->exists();

        if ($isStaff) {
            return true;
        }

        // 3. Assigned Project Member in this committee (limited update — status only)
        if ((int) $task->assigned_to === (int) $user->id) {
            return $task->activity->committee->roleAssignments()
                ->where('user_id', $user->id)
                ->where('role', ProjectRoleAssignment::ROLE_PROJECT_MEMBER)
                ->exists();
        }

        return false;
    }


    /**
     * Determine whether the user can delete the task.
     * Allowed for:
     * - Project Leader of the project
     * - Project Staff assigned to this committee
     */
    public function delete(User $user, Task $task): bool
    {
        $project = $task->activity->committee->project;

        $isLeader = $project->roleAssignments()
            ->where('user_id', $user->id)
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_LEADER)
            ->exists();

        if ($isLeader) {
            return true;
        }

        return $task->activity->committee->roleAssignments()
            ->where('user_id', $user->id)
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_STAFF)
            ->exists();
    }
}
