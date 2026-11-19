<?php

namespace App\Http\Controllers;

use App\Models\Project;
use App\Services\ProjectTimelineService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Response;

class ProjectTimelineController extends Controller
{
    public function __construct(
        protected ProjectTimelineService $timelineService
    ) {}

    /**
     * Display or return timeline and progress data for the specified project.
     */
    public function show(Request $request, Project $project): JsonResponse|Response
    {
        Gate::authorize('view', $project);

        $timelineData = $this->timelineService->getTimelineData($project, $request->user());

        if ($request->wantsJson() || $request->query('format') === 'json') {
            return response()->json([
                'success' => true,
                'data' => $timelineData,
            ]);
        }

        // Render project show page with active tab pointing to timeline
        return app(ProjectController::class)->show((string) $project->id, 'timeline');
    }
}
