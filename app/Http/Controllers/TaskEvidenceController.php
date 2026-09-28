<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreTaskEvidenceRequest;
use App\Models\Activity;
use App\Models\Committee;
use App\Models\Project;
use App\Models\Task;
use App\Models\TaskEvidence;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;

class TaskEvidenceController extends Controller
{
    /**
     * Upload supporting evidence / MOV for a task.
     */
    public function store(
        StoreTaskEvidenceRequest $request,
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
        Gate::authorize('uploadEvidence', $task);

        // 3. Store file securely
        $file = $request->file('file');
        $storedPath = Storage::disk('local')->putFile('task_evidences', $file);

        $task->evidences()->create([
            'uploaded_by'   => $request->user()->id,
            'original_name' => $file->getClientOriginalName(),
            'file_path'     => $storedPath,
            'file_size'     => $file->getSize(),
            'mime_type'     => $file->getClientMimeType() ?: ($file->getMimeType() ?: 'application/octet-stream'),
            'remarks'       => $request->validated('remarks'),
        ]);

        return redirect()->route('projects.committees.activities.show', [
            'project'   => $project->id,
            'committee' => $committee->id,
            'activity'  => $activity->id,
        ])->with('status', 'Task evidence uploaded successfully.');
    }

    /**
     * Download or stream task evidence file securely.
     */
    public function download(
        Request $request,
        Project $project,
        Committee $committee,
        Activity $activity,
        Task $task,
        TaskEvidence $evidence
    ): Response {
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

        if ((int) $evidence->task_id !== (int) $task->id) {
            abort(404, 'Evidence not found for this task.');
        }

        // 2. Authorize
        Gate::authorize('viewEvidence', $task);

        // 3. Verify file exists on private local storage
        if (! Storage::disk('local')->exists($evidence->file_path)) {
            abort(404, 'Evidence file not found on storage.');
        }

        // 4. Return inline stream or download response
        if ($request->boolean('inline') || $request->query('disposition') === 'inline') {
            return Storage::disk('local')->response($evidence->file_path, $evidence->original_name, [
                'Content-Disposition' => 'inline; filename="' . addslashes($evidence->original_name) . '"',
            ]);
        }

        return Storage::disk('local')->download($evidence->file_path, $evidence->original_name);
    }

    /**
     * Delete an evidence file.
     */
    public function destroy(
        Request $request,
        Project $project,
        Committee $committee,
        Activity $activity,
        Task $task,
        TaskEvidence $evidence
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

        if ((int) $evidence->task_id !== (int) $task->id) {
            abort(404, 'Evidence not found for this task.');
        }

        // 2. Authorize
        Gate::authorize('deleteEvidence', [$task, $evidence]);

        // 3. Remove physical file
        if (Storage::disk('local')->exists($evidence->file_path)) {
            Storage::disk('local')->delete($evidence->file_path);
        }

        // 4. Delete record
        $evidence->delete();

        return redirect()->route('projects.committees.activities.show', [
            'project'   => $project->id,
            'committee' => $committee->id,
            'activity'  => $activity->id,
        ])->with('status', 'Task evidence removed successfully.');
    }
}
