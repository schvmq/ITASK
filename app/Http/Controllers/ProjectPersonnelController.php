<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreProjectPersonnelRequest;
use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;

class ProjectPersonnelController extends Controller
{
    /**
     * Assign a user as Project Staff or Project Member to the project.
     */
    public function store(StoreProjectPersonnelRequest $request, Project $project): RedirectResponse
    {
        // Only Project Leader can assign project roles
        Gate::authorize('update', $project);

        $userId = (int) $request->validated('user_id');
        $role = $request->validated('role');

        // Step 13: Guarantee creator / Project Leader cannot be modified
        if ((int) $project->created_by === $userId) {
            abort(403, 'The Project Leader assignment cannot be altered.');
        }

        $isExistingLeader = ProjectRoleAssignment::where('project_id', $project->id)
            ->where('user_id', $userId)
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_LEADER)
            ->exists();

        if ($isExistingLeader) {
            abort(403, 'The Project Leader assignment cannot be altered.');
        }

        ProjectRoleAssignment::updateOrCreate(
            [
                'project_id' => $project->id,
                'user_id' => $userId,
            ],
            [
                'role' => $role,
            ]
        );

        return redirect()->route('projects.show', $project)->with('status', "Personnel assigned as {$role} successfully.");
    }

    /**
     * Remove a user from the project's personnel.
     */
    public function destroy(Project $project, User $user): RedirectResponse
    {
        Gate::authorize('update', $project);

        // Step 13: Prevent removing the Project Leader
        if ((int) $project->created_by === (int) $user->id) {
            abort(403, 'Cannot remove the Project Leader.');
        }

        $assignment = ProjectRoleAssignment::where('project_id', $project->id)
            ->where('user_id', $user->id)
            ->firstOrFail();

        if ($assignment->isLeader()) {
            abort(403, 'Cannot remove the Project Leader.');
        }

        $assignment->delete();

        return redirect()->route('projects.show', $project)->with('status', 'Personnel removed from project.');
    }
}
