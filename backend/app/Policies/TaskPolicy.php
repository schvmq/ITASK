<?php

namespace App\Policies;

use App\Models\Activity;
use App\Models\Project;
use App\Models\Task;
use App\Models\TaskEvidence;
use App\Models\User;
use App\Services\Authorization\AuthorizationService;

class TaskPolicy
{
    public function __construct(
        protected AuthorizationService $authService = new AuthorizationService()
    ) {}

    /**
     * Determine whether the user can view the task.
     */
    public function view(User $user, Task $task): bool
    {
        return $this->authService->canViewTask($user, $task);
    }

    /**
     * Determine whether the user can create a task under the activity.
     */
    public function create(User $user, Activity $activity): bool
    {
        return $this->authService->canCreateTask($user, $activity);
    }

    /**
     * Determine whether the user can create a task inside the project.
     */
    public function createForProject(User $user, Project $project): bool
    {
        return $this->authService->canCreateProjectTask($user, $project);
    }

    /**
     * Determine whether the user can update the task (configuration or execution).
     */
    public function update(User $user, Task $task): bool
    {
        return $this->authService->canUpdateTask($user, $task);
    }

    /**
     * Determine whether the user can update the execution status of the task.
     */
    public function updateStatus(User $user, Task $task): bool
    {
        return $this->authService->canUpdateTaskStatus($user, $task);
    }

    /**
     * Determine whether the user can delete the task.
     */
    public function delete(User $user, Task $task): bool
    {
        return $this->authService->canDeleteTask($user, $task);
    }

    /**
     * Determine whether the user can submit the task for staff review.
     */
    public function submitReview(User $user, Task $task): bool
    {
        return $this->authService->canSubmitTaskReview($user, $task);
    }

    /**
     * Determine whether the user can review (approve or return) the task.
     */
    public function review(User $user, Task $task): bool
    {
        return $this->authService->canReviewTask($user, $task);
    }

    /**
     * Determine whether the user can resubmit a returned task.
     */
    public function resubmit(User $user, Task $task): bool
    {
        return $this->authService->canResubmitTask($user, $task);
    }

    /**
     * Determine whether the user can upload evidence to the task.
     */
    public function uploadEvidence(User $user, Task $task): bool
    {
        return $this->authService->canUploadEvidence($user, $task);
    }

    /**
     * Determine whether the user can view/download task evidence.
     */
    public function viewEvidence(User $user, Task $task): bool
    {
        return $this->view($user, $task);
    }

    /**
     * Determine whether the user can delete task evidence.
     */
    public function deleteEvidence(User $user, Task $task, ?TaskEvidence $evidence = null): bool
    {
        return $this->authService->canDeleteEvidence($user, $task, $evidence);
    }
}
