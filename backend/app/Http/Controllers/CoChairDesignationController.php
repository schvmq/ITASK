<?php

namespace App\Http\Controllers;

use App\Models\CoChairDesignation;
use App\Models\Committee;
use App\Models\Project;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Gate;

class CoChairDesignationController extends Controller
{
    /**
     * Designate an existing Event participant as an Event-level Co-Chair.
     * Exclusive to the Overall Chair (Project Leader).
     */
    public function storeEvent(Request $request, Project $project): JsonResponse|RedirectResponse
    {
        Gate::authorize('designateCoChair', $project);

        $validated = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
        ]);

        $userId = (int) $validated['user_id'];

        // Prevent designating the Overall Chair themselves
        if ((int) $project->created_by === $userId || $project->roleAssignments()->where('user_id', $userId)->where('role', 'Project Leader')->exists()) {
            return $this->errorResponse($request, 'The Overall Chair cannot be designated as Co-Chair.', 422);
        }

        // Must be an existing participant in the Event
        $isParticipant = $project->roleAssignments()->where('user_id', $userId)->exists();
        if (! $isParticipant) {
            return $this->errorResponse($request, 'User must be an existing participant of this Event before being designated as Co-Chair.', 422);
        }

        // Check if already designated as Event-level Co-Chair
        $alreadyDesignated = CoChairDesignation::eventLevel()
            ->where('project_id', $project->id)
            ->where('user_id', $userId)
            ->exists();

        if ($alreadyDesignated) {
            return $this->errorResponse($request, 'User is already designated as an Event-level Co-Chair.', 422);
        }

        CoChairDesignation::create([
            'project_id' => $project->id,
            'user_id' => $userId,
            'committee_id' => null,
            'designated_by' => Auth::id(),
        ]);

        $targetUser = User::find($userId);

        if ($request->wantsJson()) {
            return response()->json([
                'message' => "{$targetUser->name} has been designated as Event-level Co-Chair.",
            ], 201);
        }

        return back()->with('status', "{$targetUser->name} has been designated as Event-level Co-Chair.");
    }

    /**
     * Remove an Event-level Co-Chair designation.
     * Reversible without removing underlying Event membership.
     */
    public function destroyEvent(Request $request, Project $project, User $user): JsonResponse|RedirectResponse
    {
        Gate::authorize('designateCoChair', $project);

        $designation = CoChairDesignation::eventLevel()
            ->where('project_id', $project->id)
            ->where('user_id', $user->id)
            ->first();

        if (! $designation) {
            return $this->errorResponse($request, 'Event-level Co-Chair designation not found.', 404);
        }

        $designation->delete();

        if ($request->wantsJson()) {
            return response()->json([
                'message' => "Event-level Co-Chair designation for {$user->name} has been removed.",
            ]);
        }

        return back()->with('status', "Event-level Co-Chair designation for {$user->name} has been removed.");
    }

    /**
     * Designate an existing Committee member as a Committee-level Co-Chair.
     * Accessible by Committee Chairperson or Overall Chair.
     */
    public function storeCommittee(Request $request, Project $project, Committee $committee): JsonResponse|RedirectResponse
    {
        if ((int) $committee->project_id !== (int) $project->id) {
            abort(404, 'Committee not found in this Event.');
        }

        Gate::authorize('designateCoChair', $committee);

        $validated = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
        ]);

        $userId = (int) $validated['user_id'];

        // Cannot designate the Committee Chairperson (Head)
        $isStaffHead = $committee->roleAssignments()
            ->where('user_id', $userId)
            ->whereIn('role', ['Project Committee', 'Project Staff'])
            ->exists();

        if ($isStaffHead) {
            return $this->errorResponse($request, 'The Committee Chairperson cannot be designated as Co-Chair.', 422);
        }

        // Must be an assigned member in this committee
        $isCommitteeMember = $committee->roleAssignments()
            ->where('user_id', $userId)
            ->exists();

        if (! $isCommitteeMember) {
            return $this->errorResponse($request, 'User must be an existing member of this committee to be designated as Committee Co-Chair.', 422);
        }

        // Check if already designated for this committee
        $alreadyDesignated = CoChairDesignation::where('project_id', $project->id)
            ->where('committee_id', $committee->id)
            ->where('user_id', $userId)
            ->exists();

        if ($alreadyDesignated) {
            return $this->errorResponse($request, 'User is already designated as a Co-Chair for this committee.', 422);
        }

        CoChairDesignation::create([
            'project_id' => $project->id,
            'user_id' => $userId,
            'committee_id' => $committee->id,
            'designated_by' => Auth::id(),
        ]);

        $targetUser = User::find($userId);

        if ($request->wantsJson()) {
            return response()->json([
                'message' => "{$targetUser->name} has been designated as Committee Co-Chair.",
            ], 201);
        }

        return back()->with('status', "{$targetUser->name} has been designated as Committee Co-Chair.");
    }

    /**
     * Remove a Committee-level Co-Chair designation.
     * Reversible without removing underlying Committee membership.
     */
    public function destroyCommittee(Request $request, Project $project, Committee $committee, User $user): JsonResponse|RedirectResponse
    {
        if ((int) $committee->project_id !== (int) $project->id) {
            abort(404, 'Committee not found in this Event.');
        }

        Gate::authorize('designateCoChair', $committee);

        $designation = CoChairDesignation::where('project_id', $project->id)
            ->where('committee_id', $committee->id)
            ->where('user_id', $user->id)
            ->first();

        if (! $designation) {
            return $this->errorResponse($request, 'Committee Co-Chair designation not found.', 404);
        }

        $designation->delete();

        if ($request->wantsJson()) {
            return response()->json([
                'message' => "Committee Co-Chair designation for {$user->name} has been removed.",
            ]);
        }

        return back()->with('status', "Committee Co-Chair designation for {$user->name} has been removed.");
    }

    protected function errorResponse(Request $request, string $message, int $status): JsonResponse|RedirectResponse
    {
        if ($request->wantsJson()) {
            return response()->json(['message' => $message], $status);
        }

        return back()->withErrors(['user_id' => $message]);
    }
}
