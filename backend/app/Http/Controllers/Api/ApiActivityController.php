<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ReviewActivityRequest;
use App\Http\Requests\SendActivityReminderRequest;
use App\Http\Requests\StoreActivityRequest;
use App\Http\Requests\SubmitActivityRequest;
use App\Http\Requests\UpdateActivityRequest;
use App\Models\Activity;
use App\Models\Committee;
use App\Models\Project;
use App\Notifications\ActivityAssignedNotification;
use App\Notifications\ActivityReminderNotification;
use App\Notifications\ActivityReviewedNotification;
use App\Notifications\ActivitySubmittedForReviewNotification;
use App\Services\Authorization\AuthorizationService;
use App\Services\ProjectProgressService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class ApiActivityController extends Controller
{
    public function __construct(
        protected ProjectProgressService $progressService,
        protected AuthorizationService $authService = new AuthorizationService()
    ) {}

    /**
     * Create activity under a committee.
     */
    public function store(StoreActivityRequest $request, Project $project, Committee $committee): JsonResponse
    {
        if ((int) $committee->project_id !== (int) $project->id) {
            return response()->json(['message' => 'Committee not found in this project.'], 404);
        }

        Gate::authorize('create', [Activity::class, $committee]);

        $activity = $committee->activities()->create([
            'project_id' => $project->id,
            'title' => $request->validated('title'),
            'description' => $request->validated('description'),
            'start_date' => $request->validated('start_date'),
            'end_date' => $request->validated('end_date'),
            'status' => Activity::STATUS_TO_DO,
            'created_by' => $request->user()->id,
        ]);

        ProjectProgressService::clearProjectProgressCache($project->id);

        return response()->json([
            'message' => 'Activity created successfully.',
            'activity' => [
                'id' => $activity->id,
                'title' => $activity->title,
                'status' => $activity->status,
            ],
        ], 201);
    }

    /**
     * Show activity details and tasks.
     */
    public function show(Project $project, Committee $committee, Activity $activity): JsonResponse
    {
        if ((int) $committee->project_id !== (int) $project->id || (int) $activity->committee_id !== (int) $committee->id) {
            return response()->json(['message' => 'Activity not found.'], 404);
        }

        Gate::authorize('view', $activity);

        $activity->load([
            'tasks.assignee:id,name,email',
            'tasks.checklistItems',
            'tasks.evidences.uploader:id,name',
            'creator:id,name',
        ]);

        return response()->json([
            'activity' => [
                'id' => $activity->id,
                'title' => $activity->title,
                'description' => $activity->description,
                'status' => $activity->status,
                'start_date' => $activity->start_date?->format('Y-m-d'),
                'end_date' => $activity->end_date?->format('Y-m-d'),
                'tasks' => $activity->tasks->map(fn ($t) => [
                    'id' => $t->id,
                    'title' => $t->title,
                    'description' => $t->description,
                    'status' => $t->status,
                    'due_date' => $t->due_date?->format('Y-m-d'),
                    'requires_review' => (bool) $t->requires_review,
                    'assignee' => $t->assignee ? [
                        'id' => $t->assignee->id,
                        'name' => $t->assignee->name,
                        'email' => $t->assignee->email,
                    ] : null,
                    'checklist_count' => $t->checklistItems->count(),
                    'evidences_count' => $t->evidences->count(),
                ]),
            ],
        ]);
    }

    /**
     * Update activity.
     */
    public function update(UpdateActivityRequest $request, Project $project, Committee $committee, Activity $activity): JsonResponse
    {
        if ((int) $committee->project_id !== (int) $project->id || (int) $activity->committee_id !== (int) $committee->id) {
            return response()->json(['message' => 'Activity not found.'], 404);
        }

        Gate::authorize('update', $activity);

        $activity->update($request->validated());
        ProjectProgressService::clearProjectProgressCache($project->id);

        return response()->json([
            'message' => 'Activity updated successfully.',
            'activity' => [
                'id' => $activity->id,
                'title' => $activity->title,
                'status' => $activity->status,
            ],
        ]);
    }

    /**
     * Delete activity.
     */
    public function destroy(Project $project, Committee $committee, Activity $activity): JsonResponse
    {
        if ((int) $committee->project_id !== (int) $project->id || (int) $activity->committee_id !== (int) $committee->id) {
            return response()->json(['message' => 'Activity not found.'], 404);
        }

        Gate::authorize('delete', $activity);

        $activity->delete();
        ProjectProgressService::clearProjectProgressCache($project->id);

        return response()->json([
            'message' => 'Activity deleted successfully.',
        ]);
    }

    /**
     * Submit activity for review.
     */
    public function submit(SubmitActivityRequest $request, Project $project, Committee $committee, Activity $activity): JsonResponse
    {
        if ((int) $committee->project_id !== (int) $project->id || (int) $activity->committee_id !== (int) $committee->id) {
            return response()->json(['message' => 'Activity not found.'], 404);
        }

        Gate::authorize('submit', $activity);

        $activity->update(['status' => Activity::STATUS_UNDER_REVIEW]);

        return response()->json([
            'message' => 'Activity submitted for review successfully.',
            'status' => Activity::STATUS_UNDER_REVIEW,
        ]);
    }

    /**
     * Review activity (approve/return).
     */
    public function review(ReviewActivityRequest $request, Project $project, Committee $committee, Activity $activity): JsonResponse
    {
        if ((int) $committee->project_id !== (int) $project->id || (int) $activity->committee_id !== (int) $committee->id) {
            return response()->json(['message' => 'Activity not found.'], 404);
        }

        Gate::authorize('review', $activity);

        $action = $request->validated('action');
        $status = in_array($action, ['complete', 'mark_completed'], true) ? Activity::STATUS_COMPLETED : Activity::STATUS_RETURNED;
        $activity->update(['status' => $status]);
        ProjectProgressService::clearProjectProgressCache($project->id);

        return response()->json([
            'message' => "Activity {$status} successfully.",
            'status' => $status,
        ]);
    }
}
