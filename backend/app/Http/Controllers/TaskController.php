<?php

namespace App\Http\Controllers;

use App\Http\Requests\ResubmitTaskRequest;
use App\Http\Requests\ReviewTaskRequest;
use App\Http\Requests\StoreProjectTaskRequest;
use App\Http\Requests\StoreTaskRequest;
use App\Http\Requests\SubmitTaskRequest;
use App\Http\Requests\UpdateTaskRequest;
use App\Models\Activity;
use App\Models\Committee;
use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Models\Task;
use App\Notifications\TaskAssignedNotification;
use App\Notifications\TaskReviewedNotification;
use App\Notifications\TaskSubmittedForReviewNotification;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class TaskController extends Controller
{
    /**
     * Store a newly created task directly from project view (auto-provisions activity/committee if needed).
     */
    public function storeProjectTask(StoreProjectTaskRequest $request, Project $project): RedirectResponse
    {
        $user = $request->user();

        $committeeId = $request->input('committee_id');
        $activityId = $request->input('activity_id');

        $committee = null;
        $activity = null;

        if ($committeeId) {
            $committee = $project->committees()->where('id', $committeeId)->first();
            if (! $committee) {
                abort(404, 'Selected committee not found in this project.');
            }
        }

        if ($activityId) {
            $query = Activity::where('project_id', $project->id)->where('id', $activityId);
            if ($committee) {
                $query->where('committee_id', $committee->id);
            }
            $activity = $query->first();
            if (! $activity) {
                abort(404, 'Selected activity not found in this project/committee.');
            }
            if (! $committee) {
                $committee = $activity->committee;
            }
        }

        // Auto-provision committee and activity if project has none yet or none selected
        if (! $committee) {
            $committee = $project->committees()->first();
            if (! $committee) {
                $committee = $project->committees()->create([
                    'name' => 'General Committee',
                    'description' => 'Default committee for project activities',
                ]);
            }
        }

        if (! $activity) {
            $activity = $committee->activities()->first();
            if (! $activity) {
                $activity = $committee->activities()->create([
                    'project_id' => $project->id,
                    'created_by' => $user->id,
                    'title' => 'General Project Tasks',
                    'description' => 'Default activity for project tasks and deliverables',
                    'status' => Activity::STATUS_TO_DO,
                    'start_date' => now()->toDateString(),
                    'due_date' => $request->validated('due_date') ?? now()->addDays(14)->toDateString(),
                ]);
            }
        }

        $description = $request->validated('description');
        $deliverableGuidelines = $request->validated('deliverable_guidelines');
        if ($deliverableGuidelines) {
            $guidelineBlock = "\n\n**Expected Deliverables:**\n" . trim($deliverableGuidelines);
            $description = $description ? ($description . $guidelineBlock) : trim($deliverableGuidelines);
        }

        $task = DB::transaction(function () use ($activity, $request, $description) {
            $task = $activity->tasks()->create([
                'title' => $request->validated('title'),
                'description' => $description,
                'due_date' => $request->validated('due_date'),
                'status' => Task::STATUS_TO_DO,
                'assigned_to' => $request->validated('assigned_to'),
                'requires_review' => $request->boolean('requires_review', false),
                'priority' => $request->input('priority', 'Medium'),
            ]);

            if ($task->assigned_to) {
                DB::table('task_assignees')->updateOrInsert(
                    ['task_id' => $task->id, 'user_id' => $task->assigned_to],
                    ['created_at' => now(), 'updated_at' => now()]
                );
            }

            // Save checklist items
            $checklist = $request->input('checklist', []);
            if (is_array($checklist)) {
                foreach ($checklist as $index => $itemContent) {
                    $content = trim((string) $itemContent);
                    if ($content !== '') {
                        $task->checklistItems()->create([
                            'content' => $content,
                            'is_completed' => false,
                            'order' => $index,
                        ]);
                    }
                }
            }

            return $task;
        });

        // Notify assigned member if assigned upon creation
        if ($task->assigned_to && $task->assignee) {
            $task->assignee->notify(new TaskAssignedNotification($task, $activity, $committee, $project));
        }

        return redirect()->route('projects.show', [
            'project' => $project->id,
            'tab' => 'tasks',
        ])->with('status', 'Task created successfully with checklists and deliverables.');
    }

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

        $task = DB::transaction(function () use ($activity, $request) {
            $task = $activity->tasks()->create([
                'title' => $request->validated('title'),
                'description' => $request->validated('description'),
                'due_date' => $request->validated('due_date'),
                'status' => Task::STATUS_TO_DO,
                'assigned_to' => $request->validated('assigned_to'),
                'requires_review' => $request->boolean('requires_review', false),
                'priority' => $request->input('priority', 'Medium'),
            ]);

            if ($task->assigned_to) {
                DB::table('task_assignees')->updateOrInsert(
                    ['task_id' => $task->id, 'user_id' => $task->assigned_to],
                    ['created_at' => now(), 'updated_at' => now()]
                );
            }

            // Save checklist items if provided
            $checklist = $request->input('checklist', []);
            if (is_array($checklist)) {
                foreach ($checklist as $index => $itemContent) {
                    $content = trim((string) $itemContent);
                    if ($content !== '') {
                        $task->checklistItems()->create([
                            'content' => $content,
                            'is_completed' => false,
                            'order' => $index,
                        ]);
                    }
                }
            }

            return $task;
        });

        // Notify assigned member if assigned upon creation
        if ($task->assigned_to && $task->assignee) {
            $task->assignee->notify(new TaskAssignedNotification($task, $activity, $committee, $project));
        }

        return $this->redirectAfterTaskAction($request, $project, $committee, $activity, 'Task created successfully.');
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

        $oldAssigneeId = $task->assigned_to;
        $task->update($request->validated());

        // Notify newly assigned member if assignment changed
        if ($request->has('assigned_to')) {
            $newAssigneeId = $task->assigned_to;
            if ($newAssigneeId && (int) $newAssigneeId !== (int) $oldAssigneeId && $task->assignee) {
                $task->assignee->notify(new TaskAssignedNotification($task, $activity, $committee, $project));
            }
        }

        return $this->redirectAfterTaskAction($request, $project, $committee, $activity, 'Task updated successfully.');
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

        return $this->redirectAfterTaskAction(request(), $project, $committee, $activity, 'Task deleted successfully.');
    }

    /**
     * Submit the task for staff review.
     */
    public function submit(SubmitTaskRequest $request, Project $project, Committee $committee, Activity $activity, Task $task): RedirectResponse
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
        Gate::authorize('submitReview', $task);

        DB::transaction(function () use ($task, $committee, $activity, $project, $request) {
            $task->update([
                'status' => Task::STATUS_UNDER_REVIEW,
            ]);

            // Notify committee staff reviewer(s)
            $staffUsers = $committee->roleAssignments()
                ->where('role', ProjectRoleAssignment::ROLE_PROJECT_STAFF)
                ->with('user')
                ->get()
                ->pluck('user')
                ->filter();

            foreach ($staffUsers as $staff) {
                if ($staff->id !== $request->user()->id) {
                    $staff->notify(new TaskSubmittedForReviewNotification(
                        $task,
                        $activity,
                        $committee,
                        $project,
                        $request->user()
                    ));
                }
            }
        });

        return $this->redirectAfterTaskAction($request, $project, $committee, $activity, 'Task submitted for review successfully.');
    }

    /**
     * Approve the task (Mark Completed).
     */
    public function approve(ReviewTaskRequest $request, Project $project, Committee $committee, Activity $activity, Task $task): RedirectResponse
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
        Gate::authorize('review', $task);

        DB::transaction(function () use ($task, $activity, $committee, $project, $request) {
            $task->update([
                'status' => Task::STATUS_COMPLETED,
            ]);

            // Notify assigned member
            if ($task->assigned_to && $task->assignee && $task->assignee->id !== $request->user()->id) {
                $task->assignee->notify(new TaskReviewedNotification(
                    $task,
                    $activity,
                    $committee,
                    $project,
                    $request->user(),
                    Task::STATUS_COMPLETED,
                    null
                ));
            }
        });

        return $this->redirectAfterTaskAction($request, $project, $committee, $activity, 'Task approved and marked as completed.');
    }

    /**
     * Return the task for revision.
     */
    public function returnForRevision(ReviewTaskRequest $request, Project $project, Committee $committee, Activity $activity, Task $task): RedirectResponse
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
        Gate::authorize('review', $task);

        $feedback = $request->validated('review_feedback');

        DB::transaction(function () use ($task, $feedback, $activity, $committee, $project, $request) {
            $task->update([
                'status' => Task::STATUS_RETURNED,
            ]);

            // Notify assigned member with review feedback
            if ($task->assigned_to && $task->assignee && $task->assignee->id !== $request->user()->id) {
                $task->assignee->notify(new TaskReviewedNotification(
                    $task,
                    $activity,
                    $committee,
                    $project,
                    $request->user(),
                    Task::STATUS_RETURNED,
                    $feedback
                ));
            }
        });

        return $this->redirectAfterTaskAction($request, $project, $committee, $activity, 'Task returned for revision.');
    }

    /**
     * Resubmit a returned task back to In Progress.
     */
    public function resubmit(ResubmitTaskRequest $request, Project $project, Committee $committee, Activity $activity, Task $task): RedirectResponse
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
        Gate::authorize('resubmit', $task);

        DB::transaction(function () use ($task) {
            $task->update([
                'status' => Task::STATUS_IN_PROGRESS,
            ]);
        });

        return $this->redirectAfterTaskAction($request, $project, $committee, $activity, 'Task resubmitted and moved to in progress.');
    }

    /**
     * Helper to redirect either back to project tasks tab or to activity show depending on referer.
     */
    protected function redirectAfterTaskAction($request, Project $project, Committee $committee, Activity $activity, string $statusMessage): RedirectResponse
    {
        $referer = $request->header('referer');
        if ($referer && str_contains($referer, '/projects/' . $project->id) && ! str_contains($referer, '/activities/')) {
            return redirect()->route('projects.show', [
                'project' => $project->id,
                'tab' => 'tasks',
            ])->with('status', $statusMessage);
        }

        return redirect()->route('projects.committees.activities.show', [
            'project' => $project->id,
            'committee' => $committee->id,
            'activity' => $activity->id,
        ])->with('status', $statusMessage);
    }
}
