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
     * Allowed ONLY for the assigned personnel on the task.
     */
    public function create(User $user, Task $task): bool
    {
        if (! $task->assigned_to || (int) $task->assigned_to !== (int) $user->id) {
            return false;
        }

        return $this->isAssignedUserAuthorizedInCommittee($user, $task);
    }

    /**
     * Determine whether the user can update a checklist item.
     * Allowed ONLY for the assigned personnel on the task.
     */
    public function update(User $user, ChecklistItem $item): bool
    {
        $task = $item->task;

        if (! $task->assigned_to || (int) $task->assigned_to !== (int) $user->id) {
            return false;
        }

        return $this->isAssignedUserAuthorizedInCommittee($user, $task);
    }

    /**
     * Determine whether the user can delete a checklist item.
     * Allowed ONLY for the assigned personnel on the task.
     */
    public function delete(User $user, ChecklistItem $item): bool
    {
        $task = $item->task;

        if (! $task->assigned_to || (int) $task->assigned_to !== (int) $user->id) {
            return false;
        }

        return $this->isAssignedUserAuthorizedInCommittee($user, $task);
    }

    /**
     * Verify the assigned user has an active role in the committee/project.
     */
    protected function isAssignedUserAuthorizedInCommittee(User $user, Task $task): bool
    {
        $committee = $task->activity->committee;
        $project = $committee->project;

        $isLeader = $project->roleAssignments()
            ->where('user_id', $user->id)
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_LEADER)
            ->exists();

        if ($isLeader) {
            return true;
        }

        return $committee->roleAssignments()
            ->where('user_id', $user->id)
            ->exists();
    }
}
