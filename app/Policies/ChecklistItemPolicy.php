<?php

namespace App\Policies;

use App\Models\ChecklistItem;
use App\Models\ProjectRoleAssignment;
use App\Models\Task;
use App\Models\User;

class ChecklistItemPolicy
{
    /**
     * Determine whether the user can create a checklist item under the task.
     * Allowed for:
     * - Project Leader of the project
     * - Project Staff assigned to this committee
     */
    public function create(User $user, Task $task): bool
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

    /**
     * Determine whether the user can update a checklist item.
     * Allowed for:
     * - Project Leader of the project
     * - Project Staff assigned to this committee
     */
    public function update(User $user, ChecklistItem $item): bool
    {
        $project = $item->task->activity->committee->project;

        $isLeader = $project->roleAssignments()
            ->where('user_id', $user->id)
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_LEADER)
            ->exists();

        if ($isLeader) {
            return true;
        }

        return $item->task->activity->committee->roleAssignments()
            ->where('user_id', $user->id)
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_STAFF)
            ->exists();
    }

    /**
     * Determine whether the user can delete a checklist item.
     * Allowed for:
     * - Project Leader of the project
     * - Project Staff assigned to this committee
     */
    public function delete(User $user, ChecklistItem $item): bool
    {
        $project = $item->task->activity->committee->project;

        $isLeader = $project->roleAssignments()
            ->where('user_id', $user->id)
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_LEADER)
            ->exists();

        if ($isLeader) {
            return true;
        }

        return $item->task->activity->committee->roleAssignments()
            ->where('user_id', $user->id)
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_STAFF)
            ->exists();
    }
}
