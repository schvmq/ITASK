<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ResubmitTaskRequest;
use App\Http\Requests\StoreChecklistItemRequest;
use App\Http\Requests\StoreTaskEvidenceRequest;
use App\Http\Requests\StoreTaskRequest;
use App\Http\Requests\SubmitTaskRequest;
use App\Http\Requests\UpdateChecklistItemRequest;
use App\Http\Requests\UpdateTaskRequest;
use App\Models\Activity;
use App\Models\ChecklistItem;
use App\Models\Committee;
use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Models\Task;
use App\Models\TaskEvidence;
use App\Notifications\TaskAssignedNotification;
use App\Notifications\TaskReviewedNotification;
use App\Notifications\TaskSubmittedForReviewNotification;
use App\Services\Authorization\AuthorizationService;
use App\Services\Authorization\RoleRegistry;
use App\Services\ProjectProgressService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ApiTaskWorkflowController extends Controller
{
    public function __construct(
        protected AuthorizationService $authService = new AuthorizationService()
    ) {}

    /**
     * Create a task under an activity.
     */
    public function storeTask(StoreTaskRequest $request, Project $project, Committee $committee, Activity $activity): JsonResponse
    {
        $this->verifyHierarchy($project, $committee, $activity);
        Gate::authorize('create', [Task::class, $activity]);

        $task = $activity->tasks()->create([
            'title' => $request->validated('title'),
            'description' => $request->validated('description'),
            'due_date' => $request->validated('due_date'),
            'status' => Task::STATUS_TO_DO,
            'assigned_to' => $request->validated('assigned_to'),
            'requires_review' => $request->boolean('requires_review', false),
        ]);

        if ($task->assigned_to && $task->assignee) {
            try {
                $task->assignee->notify(new TaskAssignedNotification($task, $activity, $committee, $project));
            } catch (\Throwable $e) {
                report($e);
            }
        }

        ProjectProgressService::clearProjectProgressCache($project->id);

        return response()->json([
            'message' => 'Task created successfully.',
            'task' => [
                'id' => $task->id,
                'title' => $task->title,
                'status' => $task->status,
                'due_date' => $task->due_date?->format('Y-m-d'),
                'requires_review' => (bool) $task->requires_review,
            ],
        ], 201);
    }

    /**
     * Update task configuration or execution state.
     */
    public function updateTask(UpdateTaskRequest $request, Project $project, Committee $committee, Activity $activity, Task $task): JsonResponse
    {
        $this->verifyHierarchy($project, $committee, $activity, $task);
        Gate::authorize('update', $task);

        $oldAssigneeId = $task->assigned_to;
        $task->update($request->validated());

        if ($request->has('assigned_to')) {
            $newAssigneeId = $task->assigned_to;
            if ($newAssigneeId && (int) $newAssigneeId !== (int) $oldAssigneeId && $task->assignee) {
                try {
                    $task->assignee->notify(new TaskAssignedNotification($task, $activity, $committee, $project));
                } catch (\Throwable $e) {
                    report($e);
                }
            }
        }

        ProjectProgressService::clearProjectProgressCache($project->id);

        return response()->json([
            'message' => 'Task updated successfully.',
            'task' => [
                'id' => $task->id,
                'title' => $task->title,
                'status' => $task->status,
            ],
        ]);
    }

    /**
     * Delete task in To Do state without evidence.
     */
    public function deleteTask(Project $project, Committee $committee, Activity $activity, Task $task): JsonResponse
    {
        $this->verifyHierarchy($project, $committee, $activity, $task);
        Gate::authorize('delete', $task);

        $task->delete();
        ProjectProgressService::clearProjectProgressCache($project->id);

        return response()->json([
            'message' => 'Task deleted successfully.',
        ]);
    }

    /**
     * Submit task for staff review.
     */
    public function submitTask(SubmitTaskRequest $request, Project $project, Committee $committee, Activity $activity, Task $task): JsonResponse
    {
        $this->verifyHierarchy($project, $committee, $activity, $task);
        Gate::authorize('submitReview', $task);

        $task->update(['status' => Task::STATUS_UNDER_REVIEW]);

        $staffUsers = $committee->roleAssignments()
            ->where('role', RoleRegistry::ROLE_PROJECT_STAFF)
            ->with('user')
            ->get();

        foreach ($staffUsers as $assignment) {
            try {
                $assignment->user->notify(new TaskSubmittedForReviewNotification($task, $activity, $committee, $project));
            } catch (\Throwable $e) {
                report($e);
            }
        }

        ProjectProgressService::clearProjectProgressCache($project->id);

        return response()->json([
            'message' => 'Task submitted for review successfully.',
            'status' => Task::STATUS_UNDER_REVIEW,
        ]);
    }

    /**
     * Approve submitted task.
     */
    public function approveTask(Project $project, Committee $committee, Activity $activity, Task $task): JsonResponse
    {
        $this->verifyHierarchy($project, $committee, $activity, $task);
        Gate::authorize('review', $task);

        if ($task->status !== Task::STATUS_UNDER_REVIEW) {
            return response()->json(['message' => 'Only tasks under review can be approved.'], 422);
        }

        $task->update(['status' => Task::STATUS_COMPLETED]);

        if ($task->assignee) {
            try {
                $task->assignee->notify(new TaskReviewedNotification($task, $activity, $committee, $project, 'approved'));
            } catch (\Throwable $e) {
                report($e);
            }
        }

        ProjectProgressService::clearProjectProgressCache($project->id);

        return response()->json([
            'message' => 'Task approved and marked completed.',
            'status' => Task::STATUS_COMPLETED,
        ]);
    }

    /**
     * Return submitted task for revision.
     */
    public function returnTask(Request $request, Project $project, Committee $committee, Activity $activity, Task $task): JsonResponse
    {
        $this->verifyHierarchy($project, $committee, $activity, $task);
        Gate::authorize('review', $task);

        if ($task->status !== Task::STATUS_UNDER_REVIEW) {
            return response()->json(['message' => 'Only tasks under review can be returned for revision.'], 422);
        }

        $validated = $request->validate([
            'reviewer_notes' => ['nullable', 'string', 'max:1000'],
            'review_feedback' => ['nullable', 'string', 'max:1000'],
        ]);

        $feedback = $validated['review_feedback'] ?? $validated['reviewer_notes'] ?? null;

        $task->update([
            'status' => Task::STATUS_RETURNED,
        ]);

        if ($task->assignee && $task->assignee->id !== $request->user()->id) {
            try {
                $task->assignee->notify(new TaskReviewedNotification(
                    $task,
                    $activity,
                    $committee,
                    $project,
                    $request->user(),
                    Task::STATUS_RETURNED,
                    $feedback
                ));
            } catch (\Throwable $e) {
                report($e);
            }
        }

        ProjectProgressService::clearProjectProgressCache($project->id);

        return response()->json([
            'message' => 'Task returned for revision.',
            'status' => Task::STATUS_RETURNED,
            'review_feedback' => $feedback,
        ]);
    }

    /**
     * Resubmit returned task.
     */
    public function resubmitTask(ResubmitTaskRequest $request, Project $project, Committee $committee, Activity $activity, Task $task): JsonResponse
    {
        $this->verifyHierarchy($project, $committee, $activity, $task);
        Gate::authorize('resubmit', $task);

        $task->update(['status' => Task::STATUS_IN_PROGRESS]);
        ProjectProgressService::clearProjectProgressCache($project->id);

        return response()->json([
            'message' => 'Task resubmitted and moved to in progress.',
            'status' => Task::STATUS_IN_PROGRESS,
        ]);
    }

    /**
     * Create checklist item under task.
     */
    public function storeChecklist(StoreChecklistItemRequest $request, Project $project, Committee $committee, Activity $activity, Task $task): JsonResponse
    {
        $this->verifyHierarchy($project, $committee, $activity, $task);
        Gate::authorize('create', [ChecklistItem::class, $task]);

        $content = $request->validated('content') ?? $request->validated('title') ?? $request->input('content') ?? $request->input('title');

        $item = $task->checklistItems()->create([
            'content' => $content,
            'is_completed' => false,
        ]);

        return response()->json([
            'message' => 'Checklist item added successfully.',
            'item' => [
                'id' => $item->id,
                'content' => $item->content,
                'is_completed' => (bool) $item->is_completed,
            ],
        ], 201);
    }

    /**
     * Update checklist item under task.
     */
    public function updateChecklist(UpdateChecklistItemRequest $request, Project $project, Committee $committee, Activity $activity, Task $task, ChecklistItem $checklistItem): JsonResponse
    {
        $this->verifyHierarchy($project, $committee, $activity, $task);
        if ((int) $checklistItem->task_id !== (int) $task->id) {
            abort(404, 'Checklist item not found in this task.');
        }
        Gate::authorize('update', $checklistItem);

        $checklistItem->update($request->validated());

        return response()->json([
            'message' => 'Checklist item updated successfully.',
            'item' => [
                'id' => $checklistItem->id,
                'content' => $checklistItem->content,
                'is_completed' => (bool) $checklistItem->is_completed,
            ],
        ]);
    }

    /**
     * Delete checklist item under task.
     */
    public function deleteChecklist(Project $project, Committee $committee, Activity $activity, Task $task, ChecklistItem $checklistItem): JsonResponse
    {
        $this->verifyHierarchy($project, $committee, $activity, $task);
        if ((int) $checklistItem->task_id !== (int) $task->id) {
            abort(404, 'Checklist item not found in this task.');
        }
        Gate::authorize('delete', $checklistItem);

        $checklistItem->delete();

        return response()->json([
            'message' => 'Checklist item removed successfully.',
        ]);
    }

    /**
     * Store evidence on task.
     */
    public function storeEvidence(StoreTaskEvidenceRequest $request, Project $project, Committee $committee, Activity $activity, Task $task): JsonResponse
    {
        $this->verifyHierarchy($project, $committee, $activity, $task);
        Gate::authorize('uploadEvidence', $task);

        $file = $request->file('file');
        $storedPath = Storage::disk('local')->putFile('task_evidences', $file);

        $evidence = $task->evidences()->create([
            'uploaded_by' => $request->user()->id,
            'original_name' => $file->getClientOriginalName(),
            'file_path' => $storedPath,
            'file_size' => $file->getSize(),
            'mime_type' => $file->getClientMimeType() ?: ($file->getMimeType() ?: 'application/octet-stream'),
            'remarks' => $request->validated('remarks') ?? $request->input('notes'),
        ]);

        return response()->json([
            'message' => 'Evidence uploaded successfully.',
            'evidence' => [
                'id' => $evidence->id,
                'original_name' => $evidence->original_name,
                'file_name' => $evidence->original_name,
                'file_size' => $evidence->file_size,
                'remarks' => $evidence->remarks,
            ],
        ], 201);
    }

    /**
     * Download task evidence.
     */
    public function downloadEvidence(Project $project, Committee $committee, Activity $activity, Task $task, TaskEvidence $evidence): StreamedResponse|JsonResponse
    {
        $this->verifyHierarchy($project, $committee, $activity, $task);
        if ((int) $evidence->task_id !== (int) $task->id) {
            abort(404, 'Evidence not found in this task.');
        }
        Gate::authorize('viewEvidence', $task);

        if (! Storage::disk('local')->exists($evidence->file_path)) {
            return response()->json(['message' => 'Evidence file not found.'], 404);
        }

        return Storage::disk('local')->download($evidence->file_path, $evidence->original_name);
    }

    /**
     * Delete task evidence.
     */
    public function deleteEvidence(Project $project, Committee $committee, Activity $activity, Task $task, TaskEvidence $evidence): JsonResponse
    {
        $this->verifyHierarchy($project, $committee, $activity, $task);
        if ((int) $evidence->task_id !== (int) $task->id) {
            abort(404, 'Evidence not found in this task.');
        }
        Gate::authorize('deleteEvidence', [$task, $evidence]);

        if (Storage::disk('local')->exists($evidence->file_path)) {
            Storage::disk('local')->delete($evidence->file_path);
        }

        $evidence->delete();

        return response()->json([
            'message' => 'Evidence removed successfully.',
        ]);
    }

    /**
     * Helper to verify entity hierarchy consistency.
     */
    protected function verifyHierarchy(Project $project, Committee $committee, Activity $activity, ?Task $task = null): void
    {
        if ((int) $committee->project_id !== (int) $project->id) {
            abort(404, 'Committee not found in this project.');
        }

        if ((int) $activity->committee_id !== (int) $committee->id || (int) $activity->project_id !== (int) $project->id) {
            abort(404, 'Activity not found in this committee.');
        }

        if ($task && (int) $task->activity_id !== (int) $activity->id) {
            abort(404, 'Task not found in this activity.');
        }
    }
}
