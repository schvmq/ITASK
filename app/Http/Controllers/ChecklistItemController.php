<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreChecklistItemRequest;
use App\Http\Requests\UpdateChecklistItemRequest;
use App\Models\Activity;
use App\Models\ChecklistItem;
use App\Models\Committee;
use App\Models\Project;
use App\Models\Task;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;

class ChecklistItemController extends Controller
{
    /**
     * Store a newly created checklist item under a task.
     */
    public function store(
        StoreChecklistItemRequest $request,
        Project $project,
        Committee $committee,
        Activity $activity,
        Task $task
    ): RedirectResponse {
        // 1. Strict hierarchy parentage checks
        if ((int) $committee->project_id !== (int) $project->id) {
            abort(404, 'Committee not found in this project.');
        }

        if ((int) $activity->committee_id !== (int) $committee->id || (int) $activity->project_id !== (int) $project->id) {
            abort(404, 'Activity not found in this committee.');
        }

        if ((int) $task->activity_id !== (int) $activity->id) {
            abort(404, 'Task not found in this activity.');
        }

        // 2. Authorize
        Gate::authorize('create', [ChecklistItem::class, $task]);

        $task->checklistItems()->create([
            'content'      => $request->validated('content'),
            'is_completed' => $request->validated('is_completed', false),
            'order'        => $request->validated('order', 0),
        ]);

        return redirect()->route('projects.committees.activities.show', [
            'project'   => $project->id,
            'committee' => $committee->id,
            'activity'  => $activity->id,
        ])->with('status', 'Checklist item added successfully.');
    }

    /**
     * Update the specified checklist item.
     */
    public function update(
        UpdateChecklistItemRequest $request,
        Project $project,
        Committee $committee,
        Activity $activity,
        Task $task,
        ChecklistItem $checklistItem
    ): RedirectResponse {
        // 1. Strict hierarchy parentage checks
        if ((int) $committee->project_id !== (int) $project->id) {
            abort(404, 'Committee not found in this project.');
        }

        if ((int) $activity->committee_id !== (int) $committee->id || (int) $activity->project_id !== (int) $project->id) {
            abort(404, 'Activity not found in this committee.');
        }

        if ((int) $task->activity_id !== (int) $activity->id) {
            abort(404, 'Task not found in this activity.');
        }

        if ((int) $checklistItem->task_id !== (int) $task->id) {
            abort(404, 'Checklist item not found in this task.');
        }

        // 2. Authorize
        Gate::authorize('update', $checklistItem);

        $checklistItem->update($request->validated());

        return redirect()->route('projects.committees.activities.show', [
            'project'   => $project->id,
            'committee' => $committee->id,
            'activity'  => $activity->id,
        ])->with('status', 'Checklist item updated successfully.');
    }

    /**
     * Remove the specified checklist item.
     */
    public function destroy(
        Project $project,
        Committee $committee,
        Activity $activity,
        Task $task,
        ChecklistItem $checklistItem
    ): RedirectResponse {
        // 1. Strict hierarchy parentage checks
        if ((int) $committee->project_id !== (int) $project->id) {
            abort(404, 'Committee not found in this project.');
        }

        if ((int) $activity->committee_id !== (int) $committee->id || (int) $activity->project_id !== (int) $project->id) {
            abort(404, 'Activity not found in this committee.');
        }

        if ((int) $task->activity_id !== (int) $activity->id) {
            abort(404, 'Task not found in this activity.');
        }

        if ((int) $checklistItem->task_id !== (int) $task->id) {
            abort(404, 'Checklist item not found in this task.');
        }

        // 2. Authorize
        Gate::authorize('delete', $checklistItem);

        $checklistItem->delete();

        return redirect()->route('projects.committees.activities.show', [
            'project'   => $project->id,
            'committee' => $committee->id,
            'activity'  => $activity->id,
        ])->with('status', 'Checklist item deleted successfully.');
    }
}
