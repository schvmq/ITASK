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
     * Determine whether the user can update the task (configuration or execution).
     *
     * - Task configuration: Project Leader or Committee Staff
     * - Task execution (status): Assigned personnel
     */
    public function update(User $user, Task $task): bool
    {
        $project = $task->activity->committee->project;

        // 1. Project Leader (configuration management)
        $isLeader = $project->roleAssignments()
            ->where('user_id', $user->id)
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_LEADER)
            ->exists();

        if ($isLeader) {
            return true;
        }

        // 2. Project Staff heading this committee (configuration management)
        $isStaff = $task->activity->committee->roleAssignments()
            ->where('user_id', $user->id)
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_STAFF)
            ->exists();

        if ($isStaff) {
            return true;
        }

        // 3. Assigned personnel (status execution updates)
        if ($task->assigned_to && (int) $task->assigned_to === (int) $user->id) {
            return $this->isAssignedUserAuthorizedInCommittee($user, $task);
        }

        return false;
    }

    /**
     * Determine whether the user can update the execution status of the task.
     * Allowed ONLY for the personnel assigned to the task.
     */
    public function updateStatus(User $user, Task $task): bool
    {
        if (! $task->assigned_to || (int) $task->assigned_to !== (int) $user->id) {
            return false;
        }

        return $this->isAssignedUserAuthorizedInCommittee($user, $task);
    }

    /**
     * Determine whether the user can delete the task.
     * Allowed for:
     * - Project Leader of the project
     * - Project Staff assigned to this committee
     *
     * Safeguards:
     * - Task must be in initial 'To Do' state (cannot delete started, under review, returned, or completed tasks)
     * - Task must have no attached evidence
     */
    public function delete(User $user, Task $task): bool
    {
        $project = $task->activity->committee->project;

        $isLeader = $project->roleAssignments()
            ->where('user_id', $user->id)
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_LEADER)
            ->exists();

        $isStaff = $task->activity->committee->roleAssignments()
            ->where('user_id', $user->id)
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_STAFF)
            ->exists();

        if (! $isLeader && ! $isStaff) {
            return false;
        }

        // Deletion safeguards:
        // 1. Task cannot be deleted once started (must be strictly 'To Do')
        if ($task->status !== Task::STATUS_TO_DO) {
            return false;
        }

        // 2. Task cannot be deleted if any evidence exists
        if ($task->evidences()->exists()) {
            return false;
        }

        return true;
    }

    /**
     * Determine whether the user can submit the task for staff review.
     * Allowed only for the assigned personnel on the task.
     */
    public function submitReview(User $user, Task $task): bool
    {
        if (! $task->assigned_to || (int) $task->assigned_to !== (int) $user->id) {
            return false;
        }

        return $this->isAssignedUserAuthorizedInCommittee($user, $task);
    }

    /**
     * Determine whether the user can review (approve or return) the task.
     * Allowed only for Project Staff assigned to this specific committee.
     */
    public function review(User $user, Task $task): bool
    {
        return $task->activity->committee->roleAssignments()
            ->where('user_id', $user->id)
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_STAFF)
            ->exists();
    }

    /**
     * Determine whether the user can resubmit a returned task.
     * Allowed only for the assigned personnel on the task.
     */
    public function resubmit(User $user, Task $task): bool
    {
        if (! $task->assigned_to || (int) $task->assigned_to !== (int) $user->id) {
            return false;
        }

        return $this->isAssignedUserAuthorizedInCommittee($user, $task);
    }

    /**
     * Determine whether the user can upload evidence to the task.
     * Allowed ONLY for the assigned personnel on the task, and only while the task
     * is in an editable execution state (To Do, In Progress, Returned).
     * Read-only in Under Review and Completed states.
     */
    public function uploadEvidence(User $user, Task $task): bool
    {
        // 1. Only the assigned personnel can upload evidence
        if (! $task->assigned_to || (int) $task->assigned_to !== (int) $user->id) {
            return false;
        }

        // 2. Assigned personnel must be authorized in committee/project
        if (! $this->isAssignedUserAuthorizedInCommittee($user, $task)) {
            return false;
        }

        // 3. Evidence is only editable in To Do, In Progress, Returned
        return in_array($task->status, [
            Task::STATUS_TO_DO,
            Task::STATUS_IN_PROGRESS,
            Task::STATUS_RETURNED,
        ], true);
    }

    /**
     * Determine whether the user can view/download task evidence.
     * Allowed for anyone who can view the task (Leader, Staff, Member in committee).
     */
    public function viewEvidence(User $user, Task $task): bool
    {
        return $this->view($user, $task);
    }

    /**
     * Determine whether the user can delete task evidence.
     * Allowed ONLY for the assigned personnel who uploaded the evidence,
     * and only while the task is in an editable execution state (To Do, In Progress, Returned).
     * Supervisors cannot delete an assignee's evidence.
     */
    public function deleteEvidence(User $user, Task $task, ?\App\Models\TaskEvidence $evidence = null): bool
    {
        // 1. Only the assigned personnel can delete evidence
        if (! $task->assigned_to || (int) $task->assigned_to !== (int) $user->id) {
            return false;
        }

        // 2. Must be the original uploader
        if ($evidence && (int) $evidence->uploaded_by !== (int) $user->id) {
            return false;
        }

        // 3. Must be authorized in committee/project
        if (! $this->isAssignedUserAuthorizedInCommittee($user, $task)) {
            return false;
        }

        // 4. Evidence is only editable in To Do, In Progress, Returned
        return in_array($task->status, [
            Task::STATUS_TO_DO,
            Task::STATUS_IN_PROGRESS,
            Task::STATUS_RETURNED,
        ], true);
    }

    /**
     * Check if the assigned user is authorized within the committee/project.
     */
    protected function isAssignedUserAuthorizedInCommittee(User $user, Task $task): bool
    {
        $committee = $task->activity->committee;
        $project = $committee->project;

        // Project Leader assigned to task
        $isLeader = $project->roleAssignments()
            ->where('user_id', $user->id)
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_LEADER)
            ->exists();

        if ($isLeader) {
            return true;
        }

        // Staff or Member in committee
        return $committee->roleAssignments()
            ->where('user_id', $user->id)
            ->exists();
    }
}

