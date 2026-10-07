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
     * - Project Creator
     * - Project Leader
     * - Project Staff (assigned to this committee)
     * - Assigned personnel on the task
     */
    public function create(User $user, Task $task): bool
    {
        return $this->canManageChecklist($user, $task);
    }

    /**
     * Determine whether the user can update a checklist item.
     * Allowed for:
     * - Project Creator
     * - Project Leader
     * - Project Staff (assigned to this committee)
     * - Assigned personnel on the task
     */
    public function update(User $user, ChecklistItem $item): bool
    {
        return $this->canManageChecklist($user, $item->task);
    }

    /**
     * Determine whether the user can delete a checklist item.
     * Allowed for:
     * - Project Creator
     * - Project Leader
     * - Project Staff (assigned to this committee)
     * - Assigned personnel on the task
     */
    public function delete(User $user, ChecklistItem $item): bool
    {
        return $this->canManageChecklist($user, $item->task);
    }

    /**
     * Check if user is authorized to manage the task checklist.
     */
    protected function canManageChecklist(User $user, Task $task): bool
    {
        $committee = $task->activity->committee;
        $project = $committee->project;

        // 1. Project Creator has full oversight
        if ((int) $project->created_by === (int) $user->id) {
            return true;
        }

        // 2. Project Leader of the project
        $isLeader = $project->roleAssignments()
            ->where('user_id', $user->id)
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_LEADER)
            ->exists();

        if ($isLeader) {
            return true;
        }

        // 3. Project Staff assigned to this specific committee
        $isStaff = $committee->roleAssignments()
            ->where('user_id', $user->id)
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_STAFF)
            ->exists();

        if ($isStaff) {
            return true;
        }

        // 4. Assigned personnel on the task
        $isAssignee = false;
        if ($task->assigned_to && (int) $task->assigned_to === (int) $user->id) {
            $isAssignee = true;
        } elseif ($task->relationLoaded('assignees') ? $task->assignees->contains('id', $user->id) : $task->assignees()->where('users.id', $user->id)->exists()) {
            $isAssignee = true;
        }

        if ($isAssignee) {
            return $this->isAssignedUserAuthorizedInCommittee($user, $task);
        }

        return false;
    }

    /**
     * Verify the assigned user has an active role in the committee/project.
     */
    protected function isAssignedUserAuthorizedInCommittee(User $user, Task $task): bool
    {
        $committee = $task->activity->committee;
        $project = $committee->project;

        if ((int) $project->created_by === (int) $user->id) {
            return true;
        }

        $isLeader = $project->roleAssignments()
            ->where('user_id', $user->id)
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_LEADER)
            ->exists();

        if ($isLeader) {
            return true;
        }

        return $committee->roleAssignments()
            ->where('user_id', $user->id)
            ->exists()
            || $project->roleAssignments()
                ->where('user_id', $user->id)
                ->exists();
    }
}
