<?php

namespace App\Services\Authorization;

use App\Models\Activity;
use App\Models\ChecklistItem;
use App\Models\Committee;
use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Models\Task;
use App\Models\TaskEvidence;
use App\Models\User;

class AuthorizationService
{
    /**
     * Check if a user has system administrator privileges.
     */
    public function isAdmin(?User $user): bool
    {
        return (bool) $user?->isAdmin();
    }

    /**
     * Check if a user is the creator or assigned leader of a project.
     */
    public function isProjectLeader(?User $user, Project $project): bool
    {
        if (! $user) {
            return false;
        }

        if ((int) $project->created_by === (int) $user->id) {
            return true;
        }

        return $project->roleAssignments()
            ->where('user_id', $user->id)
            ->where('role', RoleRegistry::ROLE_PROJECT_LEADER)
            ->exists();
    }

    /**
     * Check if a user is staff in a committee or project.
     */
    public function isStaffInCommittee(?User $user, Committee $committee): bool
    {
        if (! $user) {
            return false;
        }

        return $committee->roleAssignments()
            ->where('user_id', $user->id)
            ->whereIn('role', [
                RoleRegistry::ROLE_PROJECT_COMMITTEE,
                RoleRegistry::ROLE_PROJECT_STAFF,
            ])
            ->exists();
    }

    /**
     * Check if a user is a member in a committee.
     */
    public function isMemberInCommittee(?User $user, Committee $committee): bool
    {
        if (! $user) {
            return false;
        }

        return $committee->roleAssignments()
            ->where('user_id', $user->id)
            ->whereIn('role', [
                RoleRegistry::ROLE_COMMITTEE_STAFF,
                RoleRegistry::ROLE_PROJECT_MEMBER,
            ])
            ->exists();
    }

    /**
     * Determine whether the user can create projects.
     * In the general peer system, all non-admin verified users can create their own projects.
     */
    public function canCreateProject(?User $user): bool
    {
        if (! $user || $this->isAdmin($user)) {
            return false;
        }

        return true;
    }

    /**
     * Determine whether the user can view the project.
     */
    public function canViewProject(?User $user, Project $project): bool
    {
        if (! $user) {
            return false;
        }

        if ((int) $project->created_by === (int) $user->id) {
            return true;
        }

        return $project->roleAssignments()
            ->where('user_id', $user->id)
            ->exists();
    }

    /**
     * Determine whether the user can update the project.
     */
    public function canUpdateProject(?User $user, Project $project): bool
    {
        if (! $user) {
            return false;
        }

        return $project->roleAssignments()
            ->where('user_id', $user->id)
            ->where('role', RoleRegistry::ROLE_PROJECT_LEADER)
            ->exists();
    }

    /**
     * Determine whether the user can archive the project.
     */
    public function canArchiveProject(?User $user, Project $project): bool
    {
        return $this->canUpdateProject($user, $project);
    }

    /**
     * Determine whether the user can view a committee.
     */
    public function canViewCommittee(?User $user, Committee $committee): bool
    {
        if (! $user) {
            return false;
        }

        $project = $committee->project;

        if ($this->isProjectLeader($user, $project)) {
            return true;
        }

        return $committee->roleAssignments()
            ->where('user_id', $user->id)
            ->exists();
    }

    /**
     * Determine whether the user can create a committee within the project.
     */
    public function canCreateCommittee(?User $user, Project $project): bool
    {
        return $this->isProjectLeader($user, $project);
    }

    /**
     * Determine whether the user can update/delete/manage a committee.
     */
    public function canManageCommittee(?User $user, Committee $committee): bool
    {
        if (! $user) {
            return false;
        }

        return $this->isProjectLeader($user, $committee->project);
    }

    /**
     * Determine whether the user can assign or remove members for this committee.
     * Both the Project Leader and the designated Committee Head (Project Committee) can manage committee staff.
     */
    public function canManageCommitteeMembers(?User $user, Committee $committee): bool
    {
        if (! $user) {
            return false;
        }

        return $this->isProjectLeader($user, $committee->project)
            || $this->isStaffInCommittee($user, $committee);
    }

    /**
     * Determine whether the user can view an activity.
     */
    public function canViewActivity(?User $user, Activity $activity): bool
    {
        if (! $user) {
            return false;
        }

        $project = $activity->project;
        $committee = $activity->committee;

        if ($this->isProjectLeader($user, $project)) {
            return true;
        }

        return $committee->roleAssignments()
            ->where('user_id', $user->id)
            ->exists();
    }

    /**
     * Determine whether the user can create an activity within the committee.
     */
    public function canCreateActivity(?User $user, Committee $committee): bool
    {
        if (! $user) {
            return false;
        }

        $project = $committee->project;

        if ($this->isProjectLeader($user, $project)) {
            return true;
        }

        return $this->isStaffInCommittee($user, $committee);
    }

    /**
     * Determine whether the user can update or delete an activity.
     */
    public function canManageActivity(?User $user, Activity $activity): bool
    {
        if (! $user) {
            return false;
        }

        $project = $activity->committee->project;

        if ($this->isProjectLeader($user, $project)) {
            return true;
        }

        return $this->isStaffInCommittee($user, $activity->committee);
    }

    /**
     * Determine whether the user can submit an activity for review.
     */
    public function canSubmitActivity(?User $user, Activity $activity): bool
    {
        if (! $user) {
            return false;
        }

        $isMember = $this->isMemberInCommittee($user, $activity->committee);
        if (! $isMember) {
            return false;
        }

        return $activity->tasks()
            ->where('assigned_to', $user->id)
            ->exists();
    }

    /**
     * Determine whether the user can review an activity.
     */
    public function canReviewActivity(?User $user, Activity $activity): bool
    {
        if (! $user) {
            return false;
        }

        return $this->isStaffInCommittee($user, $activity->committee);
    }

    /**
     * Determine whether the user can send a manual reminder for the activity.
     */
    public function canSendActivityReminder(?User $user, Activity $activity): bool
    {
        if (! $user) {
            return false;
        }

        $project = $activity->project ?? $activity->committee?->project;

        if ($project && $this->isProjectLeader($user, $project)) {
            return true;
        }

        return $activity->committee?->roleAssignments()
            ->where('user_id', $user->id)
            ->whereIn('role', [
                RoleRegistry::ROLE_PROJECT_COMMITTEE,
                RoleRegistry::ROLE_PROJECT_STAFF,
            ])
            ->exists() ?? false;
    }

    /**
     * Determine whether the user can view the task.
     */
    public function canViewTask(?User $user, Task $task): bool
    {
        if (! $user) {
            return false;
        }

        $activity = $task->activity;
        $project = $activity->project;
        $committee = $activity->committee;

        if ($this->isProjectLeader($user, $project)) {
            return true;
        }

        return $committee->roleAssignments()
            ->where('user_id', $user->id)
            ->exists();
    }

    /**
     * Determine whether the user can create a task under the activity.
     */
    public function canCreateTask(?User $user, Activity $activity): bool
    {
        if (! $user) {
            return false;
        }

        $project = $activity->committee->project;

        if ($this->isProjectLeader($user, $project)) {
            return true;
        }

        return $this->isStaffInCommittee($user, $activity->committee);
    }

    /**
     * Determine whether the user can create a task inside the project.
     */
    public function canCreateProjectTask(?User $user, Project $project): bool
    {
        if (! $user) {
            return false;
        }

        if ($this->isAdmin($user) || $this->isProjectLeader($user, $project)) {
            return true;
        }

        return $project->roleAssignments()
            ->where('user_id', $user->id)
            ->whereIn('role', [
                RoleRegistry::ROLE_PROJECT_COMMITTEE,
                RoleRegistry::ROLE_PROJECT_STAFF,
            ])
            ->exists();
    }

    /**
     * Determine whether the user can update the task configuration or execution.
     */
    public function canUpdateTask(?User $user, Task $task): bool
    {
        if (! $user) {
            return false;
        }

        $project = $task->activity->committee->project;

        if ($this->isProjectLeader($user, $project)) {
            return true;
        }

        if ($this->isStaffInCommittee($user, $task->activity->committee)) {
            return true;
        }

        if ($task->assigned_to && (int) $task->assigned_to === (int) $user->id) {
            return $this->isAssignedUserAuthorizedInCommittee($user, $task);
        }

        return false;
    }

    /**
     * Determine whether the user can update the status of the task.
     */
    public function canUpdateTaskStatus(?User $user, Task $task): bool
    {
        if (! $user || ! $task->assigned_to || (int) $task->assigned_to !== (int) $user->id) {
            return false;
        }

        return $this->isAssignedUserAuthorizedInCommittee($user, $task);
    }

    /**
     * Determine whether the user can delete the task.
     */
    public function canDeleteTask(?User $user, Task $task): bool
    {
        if (! $user) {
            return false;
        }

        $project = $task->activity->committee->project;
        $isLeader = $this->isProjectLeader($user, $project);
        $isStaff = $this->isStaffInCommittee($user, $task->activity->committee);

        if (! $isLeader && ! $isStaff) {
            return false;
        }

        if ($task->status !== Task::STATUS_TO_DO) {
            return false;
        }

        if ($task->evidences()->exists()) {
            return false;
        }

        return true;
    }

    /**
     * Determine whether the user can submit the task for staff review.
     */
    public function canSubmitTaskReview(?User $user, Task $task): bool
    {
        if (! $user || ! $task->assigned_to || (int) $task->assigned_to !== (int) $user->id) {
            return false;
        }

        return $this->isAssignedUserAuthorizedInCommittee($user, $task);
    }

    /**
     * Determine whether the user can review (approve/return) the task.
     */
    public function canReviewTask(?User $user, Task $task): bool
    {
        if (! $user) {
            return false;
        }

        return $this->isStaffInCommittee($user, $task->activity->committee);
    }

    /**
     * Determine whether the user can resubmit a returned task.
     */
    public function canResubmitTask(?User $user, Task $task): bool
    {
        return $this->canSubmitTaskReview($user, $task);
    }

    /**
     * Determine whether the user can upload evidence to the task.
     */
    public function canUploadEvidence(?User $user, Task $task): bool
    {
        if (! $user || ! $task->assigned_to || (int) $task->assigned_to !== (int) $user->id) {
            return false;
        }

        if (! $this->isAssignedUserAuthorizedInCommittee($user, $task)) {
            return false;
        }

        return in_array($task->status, [
            Task::STATUS_TO_DO,
            Task::STATUS_IN_PROGRESS,
            Task::STATUS_RETURNED,
        ], true);
    }

    /**
     * Determine whether the user can delete task evidence.
     */
    public function canDeleteEvidence(?User $user, Task $task, ?TaskEvidence $evidence = null): bool
    {
        if (! $user || ! $task->assigned_to || (int) $task->assigned_to !== (int) $user->id) {
            return false;
        }

        if ($evidence && (int) $evidence->uploaded_by !== (int) $user->id) {
            return false;
        }

        if (! $this->isAssignedUserAuthorizedInCommittee($user, $task)) {
            return false;
        }

        return in_array($task->status, [
            Task::STATUS_TO_DO,
            Task::STATUS_IN_PROGRESS,
            Task::STATUS_RETURNED,
        ], true);
    }

    /**
     * Check if user is authorized to manage the task checklist.
     */
    public function canManageChecklist(?User $user, Task $task): bool
    {
        if (! $user) {
            return false;
        }

        if (! $task->relationLoaded('activity')) {
            $task->load('activity.committee.project');
        }

        $activity = $task->activity;
        $committee = $activity?->committee;
        $project = $committee?->project;

        if (! $activity || ! $committee || ! $project) {
            return false;
        }

        if ($this->isProjectLeader($user, $project)) {
            return true;
        }

        $isStaff = $committee->roleAssignments()
            ->where('user_id', $user->id)
            ->whereIn('role', [
                RoleRegistry::ROLE_PROJECT_COMMITTEE,
                RoleRegistry::ROLE_PROJECT_STAFF,
            ])
            ->exists()
            || $project->roleAssignments()
            ->where('user_id', $user->id)
            ->whereIn('role', [
                RoleRegistry::ROLE_PROJECT_COMMITTEE,
                RoleRegistry::ROLE_PROJECT_STAFF,
            ])
            ->whereNull('committee_id')
            ->exists();

        if ($isStaff) {
            return true;
        }

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

    /**
     * Check if the assigned user is authorized within the committee/project.
     */
    public function isAssignedUserAuthorizedInCommittee(User $user, Task $task): bool
    {
        $committee = $task->activity->committee;
        $project = $committee->project;

        if ($this->isProjectLeader($user, $project)) {
            return true;
        }

        return $committee->roleAssignments()
            ->where('user_id', $user->id)
            ->exists();
    }

    /**
     * Compute primary role for a user across projects (for UI navigation & display).
     */
    public function getPrimaryRole(User $user): string
    {
        $userId = $user->id;
        $isLeader = Project::where('created_by', $userId)
            ->orWhereHas('roleAssignments', fn ($q) => $q->where('user_id', $userId)->where('role', RoleRegistry::ROLE_PROJECT_LEADER))
            ->exists();

        if ($isLeader) {
            return RoleRegistry::ROLE_PROJECT_LEADER;
        }

        $isCommittee = ProjectRoleAssignment::where('user_id', $userId)
            ->whereIn('role', [RoleRegistry::ROLE_PROJECT_COMMITTEE, RoleRegistry::ROLE_PROJECT_STAFF])
            ->exists();

        if ($isCommittee) {
            return RoleRegistry::ROLE_PROJECT_COMMITTEE;
        }

        $isStaff = ProjectRoleAssignment::where('user_id', $userId)
            ->whereIn('role', [RoleRegistry::ROLE_COMMITTEE_STAFF, RoleRegistry::ROLE_PROJECT_MEMBER])
            ->exists();

        if ($isStaff) {
            return RoleRegistry::ROLE_COMMITTEE_STAFF;
        }

        return RoleRegistry::ROLE_COMMITTEE_STAFF;
    }

    /**
     * Compute all distinct roles held by a user across all projects.
     */
    public function getUserRoles(User $user): array
    {
        $roles = [];

        if (Project::where('created_by', $user->id)->orWhereHas('roleAssignments', fn ($q) => $q->where('user_id', $user->id)->where('role', RoleRegistry::ROLE_PROJECT_LEADER))->exists()) {
            $roles[] = RoleRegistry::ROLE_PROJECT_LEADER;
        }

        if (ProjectRoleAssignment::where('user_id', $user->id)->whereIn('role', [RoleRegistry::ROLE_PROJECT_COMMITTEE, RoleRegistry::ROLE_PROJECT_STAFF])->exists()) {
            $roles[] = RoleRegistry::ROLE_PROJECT_COMMITTEE;
            $roles[] = RoleRegistry::ROLE_PROJECT_STAFF;
        }

        if (ProjectRoleAssignment::where('user_id', $user->id)->whereIn('role', [RoleRegistry::ROLE_COMMITTEE_STAFF, RoleRegistry::ROLE_PROJECT_MEMBER])->exists()) {
            $roles[] = RoleRegistry::ROLE_COMMITTEE_STAFF;
            $roles[] = RoleRegistry::ROLE_PROJECT_MEMBER;
        }

        if (empty($roles)) {
            $roles[] = RoleRegistry::ROLE_COMMITTEE_STAFF;
            $roles[] = RoleRegistry::ROLE_PROJECT_MEMBER;
        }

        return array_values(array_unique($roles));
    }
}
