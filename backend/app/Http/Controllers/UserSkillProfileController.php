<?php

namespace App\Http\Controllers;

use App\Http\Requests\UpdateSkillProfileRequest;
use App\Services\Skills\SkillProfileService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class UserSkillProfileController extends Controller
{
    public function __construct(
        protected SkillProfileService $profileService
    ) {}

    /**
     * Render the account-level skill profile page.
     */
    public function showProfile(Request $request): Response
    {
        $profileData = $this->profileService->getProfileData($request->user());

        return Inertia::render('Profile/Skills', $profileData);
    }

    /**
     * Render the post-verification onboarding skill assessment page.
     */
    public function showOnboarding(Request $request): Response
    {
        $profileData = $this->profileService->getProfileData($request->user());

        return Inertia::render('Onboarding/SkillAssessment', $profileData);
    }

    /**
     * Persist partial or complete rating updates.
     */
    public function update(UpdateSkillProfileRequest $request): JsonResponse|RedirectResponse
    {
        $updatedProfile = $this->profileService->updateRatings(
            $request->user(),
            $request->validated('ratings')
        );

        if ($request->wantsJson()) {
            return response()->json([
                'success' => true,
                'message' => 'Skill ratings updated successfully.',
                'data' => $updatedProfile,
            ]);
        }

        return back()->with('status', 'Skill ratings updated successfully.');
    }

    /**
     * Process Complete Later action during onboarding.
     */
    public function completeLater(Request $request): JsonResponse|RedirectResponse
    {
        $ratings = $request->input('ratings');
        if (is_array($ratings) && !empty($ratings)) {
            // Validate optional pending ratings if submitted alongside complete later
            $validated = $request->validate([
                'ratings' => ['array'],
                'ratings.*.skill_id' => ['required', 'integer', 'exists:skills,id', 'distinct'],
                'ratings.*.rating' => [
                    'nullable',
                    function ($attribute, $value, $fail) {
                        if ($value === null) {
                            return;
                        }
                        if (is_bool($value)) {
                            $fail('The rating must be an integer between 0 and 4, or unrated.');
                            return;
                        }
                        if (!is_int($value) && (!is_string($value) || !preg_match('/^[0-4]$/', $value))) {
                            $fail('The rating must be an integer between 0 and 4, or unrated.');
                            return;
                        }
                        $intVal = (int) $value;
                        if ($intVal < 0 || $intVal > 4) {
                            $fail('The rating must be between 0 (No experience) and 4 (Highly proficient).');
                        }
                    },
                ],
            ]);
            $ratings = $validated['ratings'];
        } else {
            $ratings = null;
        }

        $this->profileService->acknowledgeOnboarding($request->user(), $ratings);

        if ($request->wantsJson()) {
            return response()->json([
                'success' => true,
                'message' => 'Onboarding skipped. You can update your skills anytime from your profile.',
                'redirect_url' => route('dashboard'),
            ]);
        }

        return redirect()->route('dashboard')->with('status', 'Onboarding skipped. You can update your skills anytime from your profile.');
    }
}
