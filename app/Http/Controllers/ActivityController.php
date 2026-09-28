<?php

namespace App\Http\Controllers;

use App\Http\Requests\ReviewActivityRequest;
use App\Http\Requests\StoreActivityRequest;
use App\Http\Requests\SubmitActivityRequest;
use App\Http\Requests\UpdateActivityRequest;
use App\Models\Activity;
use App\Models\ChecklistItem;
use App\Models\Committee;
use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Models\Task;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class ActivityController extends Controller
{
    /**
     * Store a newly created activity in storage.
     */
    public function store(StoreActivityRequest $request, Project $project, Committee $committee): RedirectResponse
    {
        // 1. Verify parent hierarchy relationship
        if ((int) $committee->project_id !== (int) $project->id) {
            abort(404, 'Committee does not belong to this project.');
        }

        // 2. Authorize
        Gate::authorize('create', [Activity::class, $committee]);

        $activity = $committee->activities()->create([
            'project_id'  => $project->id,
            'created_by'  => Auth::id(),
            'title'       => $request->validated('title'),
            'description' => $request->validated('description'),
            'start_date'  => $request->validated('start_date'),
            'due_date'    => $request->validated('due_date'),
            'status'      => $request->validated('status', Activity::STATUS_TO_DO),
        ]);

        return redirect()->route('projects.committees.activities.show', [
            'project' => $project->id,
            'committee' => $committee->id,
            'activity' => $activity->id,
        ])->with('status', 'Activity created successfully.');
    }

    /**
     * Display the specified activity details with its task list.
     */
    public function show(Project $project, Committee $committee, Activity $activity): Response
    {
        // 1. Strict hierarchy parentage checks
        if ((int) $committee->project_id !== (int) $project->id) {
            abort(404, 'Committee not found in this project.');
        }

        if ((int) $activity->committee_id !== (int) $committee->id || (int) $activity->project_id !== (int) $project->id) {
            abort(404, 'Activity not found in this committee.');
        }

        // 2. Authorize view
        Gate::authorize('view', $activity);

        $activity->load([
            'creator',
            'reviewer',
            'committee.staffAssignment.user',
            'tasks.assignee',
            'tasks.checklistItems',
        ]);

        $user = Auth::user();

        // Eligible assignees for tasks: members and staff assigned to this committee
        $eligibleAssignees = $committee->roleAssignments()
            ->with('user')
            ->get()
            ->map(fn ($assignment) => [
                'id' => $assignment->user->id,
                'name' => $assignment->user->name,
                'email' => $assignment->user->email,
                'role' => $assignment->role,
            ])
            ->values()
            ->all();

        $activityData = [
            'id'              => (string) $activity->id,
            'title'           => $activity->title,
            'description'     => $activity->description,
            'status'          => $activity->status,
            'start_date'      => $activity->start_date?->format('M d, Y'),
            'start_date_raw'  => $activity->start_date?->format('Y-m-d'),
            'due_date'        => $activity->due_date?->format('M d, Y'),
            'due_date_raw'    => $activity->due_date?->format('Y-m-d'),
            'submission_notes' => $activity->submission_notes,
            'review_feedback' => $activity->review_feedback,
            'reviewed_at' => $activity->reviewed_at?->format('M d, Y, g:i A'),
            'reviewed_at_raw' => $activity->reviewed_at?->toISOString(),
            'created_at' => $activity->created_at?->format('M d, Y'),
            'creator' => $activity->creator ? [
                'id' => $activity->creator->id,
                'name' => $activity->creator->name,
                'email' => $activity->creator->email,
            ] : null,
            'reviewer' => $activity->reviewer ? [
                'id' => $activity->reviewer->id,
                'name' => $activity->reviewer->name,
                'email' => $activity->reviewer->email,
            ] : null,
            'can' => [
                'update' => $user ? Gate::forUser($user)->allows('update', $activity) : false,
                'delete' => $user ? Gate::forUser($user)->allows('delete', $activity) : false,
                'createTask' => $user ? Gate::forUser($user)->allows('create', [Task::class, $activity]) : false,
                'submit' => $user ? Gate::forUser($user)->allows('submit', $activity) && in_array($activity->status, [Activity::STATUS_TO_DO, Activity::STATUS_IN_PROGRESS, Activity::STATUS_RETURNED_FOR_REVISION], true) : false,
                'review' => $user ? Gate::forUser($user)->allows('review', $activity) && $activity->status === Activity::STATUS_UNDER_REVIEW : false,
            ],
            'tasks' => $activity->tasks->map(fn ($task) => [
                'id'              => (string) $task->id,
                'title'           => $task->title,
                'description'     => $task->description,
                'status'          => $task->status,
                'due_date'        => $task->due_date?->format('M d, Y'),
                'due_date_raw'    => $task->due_date?->format('Y-m-d'),
                'is_assigned_to_me' => $user ? (int) $task->assigned_to === (int) $user->id : false,
                'assignee'        => $task->assignee ? [
                    'id'    => $task->assignee->id,
                    'name'  => $task->assignee->name,
                    'email' => $task->assignee->email,
                ] : null,
                'checklist_items' => $task->checklistItems->map(fn ($item) => [
                    'id'           => (string) $item->id,
                    'content'      => $item->content,
                    'is_completed' => $item->is_completed,
                    'order'        => $item->order,
                ])->values()->all(),
                'can' => [
                    'update'          => $user ? Gate::forUser($user)->allows('update', $task) : false,
                    'delete'          => $user ? Gate::forUser($user)->allows('delete', $task) : false,
                    'updateStatus'    => $user ? (Gate::forUser($user)->allows('update', $task) || ((int) $task->assigned_to === (int) $user->id && $committee->roleAssignments()->where('user_id', $user->id)->where('role', ProjectRoleAssignment::ROLE_PROJECT_MEMBER)->exists())) : false,
                    'manageChecklist' => $user ? Gate::forUser($user)->allows('create', [ChecklistItem::class, $task]) : false,
                ],
            ])->values()->all(),
        ];

        return Inertia::render('Activities/Show', [
            'project' => [
                'id' => (string) $project->id,
                'title' => $project->title,
                'status' => $project->status,
            ],
            'committee' => [
                'id' => (string) $committee->id,
                'name' => $committee->name,
                'head' => $committee->staffAssignment?->user ? [
                    'id' => $committee->staffAssignment->user->id,
                    'name' => $committee->staffAssignment->user->name,
                    'email' => $committee->staffAssignment->user->email,
                ] : null,
            ],
            'activity' => $activityData,
            'eligibleAssignees' => $eligibleAssignees,
        ]);
    }

    /**
     * Update the specified activity.
     */
    public function update(UpdateActivityRequest $request, Project $project, Committee $committee, Activity $activity): RedirectResponse
    {
        // 1. Strict hierarchy parentage checks
        if ((int) $committee->project_id !== (int) $project->id) {
            abort(404, 'Committee not found in this project.');
        }

        if ((int) $activity->committee_id !== (int) $committee->id || (int) $activity->project_id !== (int) $project->id) {
            abort(404, 'Activity not found in this committee.');
        }

        // 2. Authorize
        Gate::authorize('update', $activity);

        $activity->update($request->validated());

        return redirect()->route('projects.committees.activities.show', [
            'project' => $project->id,
            'committee' => $committee->id,
            'activity' => $activity->id,
        ])->with('status', 'Activity updated successfully.');
    }

    /**
     * Remove the specified activity from storage.
     */
    public function destroy(Project $project, Committee $committee, Activity $activity): RedirectResponse
    {
        // 1. Strict hierarchy parentage checks
        if ((int) $committee->project_id !== (int) $project->id) {
            abort(404, 'Committee not found in this project.');
        }

        if ((int) $activity->committee_id !== (int) $committee->id || (int) $activity->project_id !== (int) $project->id) {
            abort(404, 'Activity not found in this committee.');
        }

        // 2. Authorize
        Gate::authorize('delete', $activity);

        $activity->delete();

        return redirect()->route('projects.committees.show', [
            'project' => $project->id,
            'committee' => $committee->id,
        ])->with('status', 'Activity deleted successfully.');
    }

    /**
     * Submit the specified activity for staff review.
     */
    public function submit(SubmitActivityRequest $request, Project $project, Committee $committee, Activity $activity): RedirectResponse
    {
        // 1. Strict hierarchy parentage checks
        if ((int) $committee->project_id !== (int) $project->id) {
            abort(404, 'Committee not found in this project.');
        }

        if ((int) $activity->committee_id !== (int) $committee->id || (int) $activity->project_id !== (int) $project->id) {
            abort(404, 'Activity not found in this committee.');
        }

        // 2. Authorize
        Gate::authorize('submit', $activity);

        // 3. Update status & submission notes
        $activity->update([
            'status' => Activity::STATUS_UNDER_REVIEW,
            'submission_notes' => $request->validated('submission_notes'),
        ]);

        return redirect()->route('projects.committees.activities.show', [
            'project' => $project->id,
            'committee' => $committee->id,
            'activity' => $activity->id,
        ])->with('status', 'Activity submitted for review successfully.');
    }

    /**
     * Review the specified activity (Mark Completed or Return for Revision).
     */
    public function review(ReviewActivityRequest $request, Project $project, Committee $committee, Activity $activity): RedirectResponse
    {
        // 1. Strict hierarchy parentage checks
        if ((int) $committee->project_id !== (int) $project->id) {
            abort(404, 'Committee not found in this project.');
        }

        if ((int) $activity->committee_id !== (int) $committee->id || (int) $activity->project_id !== (int) $project->id) {
            abort(404, 'Activity not found in this committee.');
        }

        // 2. Authorize
        Gate::authorize('review', $activity);

        $action = $request->validated('action');

        if (in_array($action, ['complete', 'mark_completed'], true)) {
            $activity->update([
                'status' => Activity::STATUS_COMPLETED,
                'reviewed_by' => $request->user()->id,
                'reviewed_at' => now(),
                'review_feedback' => null,
            ]);
            $message = 'Activity marked as completed.';
        } else {
            $activity->update([
                'status' => Activity::STATUS_RETURNED_FOR_REVISION,
                'reviewed_by' => $request->user()->id,
                'reviewed_at' => now(),
                'review_feedback' => $request->validated('review_feedback'),
            ]);
            $message = 'Activity returned for revision.';
        }

        return redirect()->route('projects.committees.activities.show', [
            'project' => $project->id,
            'committee' => $committee->id,
            'activity' => $activity->id,
        ])->with('status', $message);
    }

    /**
     * Mark the activity as completed (alias to review).
     */
    public function markCompleted(ReviewActivityRequest $request, Project $project, Committee $committee, Activity $activity): RedirectResponse
    {
        return $this->review($request, $project, $committee, $activity);
    }

    /**
     * Return the activity for revision (alias to review).
     */
    public function returnForRevision(ReviewActivityRequest $request, Project $project, Committee $committee, Activity $activity): RedirectResponse
    {
        return $this->review($request, $project, $committee, $activity);
    }
}
