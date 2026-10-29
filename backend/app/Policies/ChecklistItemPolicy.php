<?php

namespace App\Policies;

use App\Models\ChecklistItem;
use App\Models\Task;
use App\Models\User;
use App\Services\Authorization\AuthorizationService;

class ChecklistItemPolicy
{
    public function __construct(
        protected AuthorizationService $authService = new AuthorizationService()
    ) {}

    /**
     * Determine whether the user can create a checklist item under the task.
     */
    public function create(User $user, Task $task): bool
    {
        return $this->authService->canManageChecklist($user, $task);
    }

    /**
     * Determine whether the user can update a checklist item.
     */
    public function update(User $user, ChecklistItem $item): bool
    {
        return $this->authService->canManageChecklist($user, $item->task);
    }

    /**
     * Determine whether the user can delete a checklist item.
     */
    public function delete(User $user, ChecklistItem $item): bool
    {
        return $this->authService->canManageChecklist($user, $item->task);
    }
}
