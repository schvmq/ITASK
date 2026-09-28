<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreTaskRequest;
use App\Http\Requests\UpdateTaskRequest;
use App\Models\Activity;
use App\Models\Committee;
use App\Models\Project;
use App\Models\Task;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;

class TaskController extends Controller
{
    /**
     * Store a newly created task under an activity.
     */
    public function store(StoreTaskRequest $request, Project $project, Committee $committee, Activity $activity): RedirectResponse
    {
        // 1. Strict hierarchy parentage checks
        if ((int) $committee->project_id !== (int) $project->id) {
            abort(404, 'Committee not found in this project.');
        }

        if ((int) $activity->committee_id !== (int) $committee->id || (int) $activity->project_id !== (int) $project->id) {
            abort(404, 'Activity not found in this committee.');
        }

        // 2. Authorize
        Gate::authorize('create', [Task::class, $activity]);

        $activity->tasks()->create([
            'title' => $request->validated('title'),
            'description' => $request->validated('description'),
            'due_date' => $request->validated('due_date'),
            'status' => $request->validated('status', Task::STATUS_TO_DO),
            'assigned_to' => $request->validated('assigned_to'),
        ]);

        return redirect()->route('projects.committees.activities.show', [
            'project' => $project->id,
            'committee' => $committee->id,
            'activity' => $activity->id,
        ])->with('status', 'Task created successfully.');
    }

    /**
     * Update the specified task.
     */
    public function update(UpdateTaskRequest $request, Project $project, Committee $committee, Activity $activity, Task $task): RedirectResponse
    {
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
        Gate::authorize('update', $task);

        $task->update($request->validated());

        return redirect()->route('projects.committees.activities.show', [
            'project' => $project->id,
            'committee' => $committee->id,
            'activity' => $activity->id,
        ])->with('status', 'Task updated successfully.');
    }

    /**
     * Remove the specified task from storage.
     */
    public function destroy(Project $project, Committee $committee, Activity $activity, Task $task): RedirectResponse
    {
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
        Gate::authorize('delete', $task);

        $task->delete();

        return redirect()->route('projects.committees.activities.show', [
            'project' => $project->id,
            'committee' => $committee->id,
            'activity' => $activity->id,
        ])->with('status', 'Task deleted successfully.');
    }
}
