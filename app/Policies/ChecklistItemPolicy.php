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
     * Allowed for Project Leader, Staff, and Members belonging to the project/committee.
     */
    public function create(User $user, Task $task): bool
    {
        return $this->canManageChecklist($user, $task);
    }

    /**
     * Determine whether the user can update a checklist item.
     * Allowed for Project Leader, Staff, and Members belonging to the project/committee.
     */
    public function update(User $user, ChecklistItem $item): bool
    {
        return $this->canManageChecklist($user, $item->task);
    }

    /**
     * Determine whether the user can delete a checklist item.
     * Allowed for Project Leader, Staff, and Members belonging to the project/committee.
     */
    public function delete(User $user, ChecklistItem $item): bool
    {
        return $this->canManageChecklist($user, $item->task);
    }

    /**
     * Check if user is authorized to manage the task checklist.
     * Supports Project Leader, Project Staff, and Project Member roles within the project.
     */
    protected function canManageChecklist(User $user, Task $task): bool
    {
        if (! $task->relationLoaded('activity')) {
            $task->load('activity.committee.project');
        }

        $activity = $task->activity;
        if (! $activity) {
            return false;
        }

        $committee = $activity->committee;
        if (! $committee) {
            return false;
        }

        $project = $committee->project;
        if (! $project) {
            return false;
        }

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

        // 3. Project Staff assigned to this specific committee OR general project staff (committee_id is null)
        $isStaff = $committee->roleAssignments()
            ->where('user_id', $user->id)
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_STAFF)
            ->exists()
            || $project->roleAssignments()
            ->where('user_id', $user->id)
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_STAFF)
            ->whereNull('committee_id')
            ->exists();

        if ($isStaff) {
            return true;
        }

        // 4. Assigned personnel on the task
        $hasAssignee = (bool) $task->assigned_to;
        $isAssignee = false;
        if ($task->assigned_to && (int) $task->assigned_to === (int) $user->id) {
            $isAssignee = true;
        } elseif ($task->relationLoaded('assignees') ? $task->assignees->contains('id', $user->id) : $task->assignees()->where('users.id', $user->id)->exists()) {
            $isAssignee = true;
        }

        if ($isAssignee) {
            return true;
        }

        // 5. If task is unassigned, any member of the committee or project can manage checklist items
        if (! $hasAssignee) {
            $isMember = $committee->roleAssignments()
                ->where('user_id', $user->id)
                ->exists()
                || $project->roleAssignments()
                ->where('user_id', $user->id)
                ->exists();

            if ($isMember) {
                return true;
            }
        }

        return false;
    }
}
