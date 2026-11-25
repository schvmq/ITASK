<?php

namespace Tests\Feature;

use App\Models\Skill;
use App\Models\SkillCategory;
use App\Models\User;
use App\Models\UserSkillRating;
use Database\Seeders\StandardizedSkillsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\URL;
use Tests\TestCase;

class SkillProfileManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(StandardizedSkillsSeeder::class);
    }

    /**
     * Test 1: Successful Email Verification Redirects to Skill Onboarding if Unacknowledged.
     */
    public function test_email_verification_redirects_to_skill_onboarding_when_unacknowledged(): void
    {
        $user = User::factory()->unverified()->create([
            'skill_onboarding_acknowledged_at' => null,
            'skill_assessment_completed_at' => null,
        ]);

        $verificationUrl = URL::temporarySignedRoute(
            'verification.verify',
            now()->addMinutes(60),
            ['id' => $user->id, 'hash' => sha1($user->email)]
        );

        $response = $this->actingAs($user)->get($verificationUrl);

        $this->assertTrue($user->fresh()->hasVerifiedEmail());
        $response->assertRedirect(route('onboarding.skills'));
    }

    /**
     * Test 2: Email Verification Redirects to Dashboard if Already Acknowledged.
     */
    public function test_email_verification_redirects_to_dashboard_if_already_acknowledged(): void
    {
        $user = User::factory()->unverified()->create();
        $user->forceFill(['skill_onboarding_acknowledged_at' => now()])->save();

        $verificationUrl = URL::temporarySignedRoute(
            'verification.verify',
            now()->addMinutes(60),
            ['id' => $user->id, 'hash' => sha1($user->email)]
        );

        $response = $this->actingAs($user)->get($verificationUrl);

        $this->assertTrue($user->fresh()->hasVerifiedEmail());
        $response->assertRedirect(route('dashboard'));
    }

    /**
     * Test 3: Complete Later Sets Acknowledged Timestamp and Redirects to Dashboard.
     */
    public function test_complete_later_action_persists_acknowledgement_and_redirects(): void
    {
        $user = User::factory()->create([
            'skill_onboarding_acknowledged_at' => null,
            'skill_assessment_completed_at' => null,
        ]);

        $response = $this->actingAs($user)->post(route('onboarding.skills.complete-later'));

        $user->refresh();
        $this->assertTrue($user->hasAcknowledgedSkillOnboarding());
        $this->assertFalse($user->hasCompletedSkillAssessment());
        $response->assertRedirect(route('dashboard'));
    }

    /**
     * Test 4: Complete Later Preserves Entered Ratings.
     */
    public function test_complete_later_preserves_entered_ratings(): void
    {
        $user = User::factory()->create([
            'skill_onboarding_acknowledged_at' => null,
            'skill_assessment_completed_at' => null,
        ]);
        $skill = Skill::first();

        $response = $this->actingAs($user)->post(route('onboarding.skills.complete-later'), [
            'ratings' => [
                ['skill_id' => $skill->id, 'rating' => 3],
            ],
        ]);

        $user->refresh();
        $this->assertTrue($user->hasAcknowledgedSkillOnboarding());
        $this->assertFalse($user->hasCompletedSkillAssessment());
        $this->assertDatabaseHas('user_skill_ratings', [
            'user_id' => $user->id,
            'skill_id' => $skill->id,
            'rating' => 3,
        ]);
        $response->assertRedirect(route('dashboard'));
    }

    /**
     * Test 5: User Can Access Questionnaire via Profile and Get All 18 Skills across 4 Categories.
     */
    public function test_user_can_retrieve_questionnaire_with_correct_structure(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->get(route('profile.skills'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Profile/Skills')
            ->has('categories', 4)
            ->where('total_skills', 18)
            ->where('rated_count', 0)
            ->where('is_completed', false)
        );
    }

    /**
     * Test 6: Valid Ratings from 0 to 4 are Accepted.
     */
    public function test_valid_ratings_from_zero_to_four_are_persisted(): void
    {
        $user = User::factory()->create();
        $skills = Skill::take(2)->get();

        $response = $this->actingAs($user)->postJson(route('profile.skills.update'), [
            'ratings' => [
                ['skill_id' => $skills[0]->id, 'rating' => 0],
                ['skill_id' => $skills[1]->id, 'rating' => 4],
            ],
        ]);

        $response->assertOk();
        $this->assertDatabaseHas('user_skill_ratings', [
            'user_id' => $user->id,
            'skill_id' => $skills[0]->id,
            'rating' => 0,
        ]);
        $this->assertDatabaseHas('user_skill_ratings', [
            'user_id' => $user->id,
            'skill_id' => $skills[1]->id,
            'rating' => 4,
        ]);
    }

    /**
     * Test 7: Invalid Ratings are Rejected with Validation Error.
     */
    public function test_invalid_rating_values_are_rejected(): void
    {
        $user = User::factory()->create();
        $skill = Skill::first();

        $response = $this->actingAs($user)->postJson(route('profile.skills.update'), [
            'ratings' => [
                ['skill_id' => $skill->id, 'rating' => 5], // Exceeds max 4
            ],
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['ratings.0.rating']);

        $response2 = $this->actingAs($user)->postJson(route('profile.skills.update'), [
            'ratings' => [
                ['skill_id' => $skill->id, 'rating' => -1], // Below min 0
            ],
        ]);

        $response2->assertStatus(422);
        $response2->assertJsonValidationErrors(['ratings.0.rating']);
    }

    /**
     * Test 8: Invalid Skill IDs are Rejected.
     */
    public function test_invalid_skill_id_is_rejected(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->postJson(route('profile.skills.update'), [
            'ratings' => [
                ['skill_id' => 999999, 'rating' => 2],
            ],
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['ratings.0.skill_id']);
    }

    /**
     * Test 9: Duplicate Skill IDs in Request are Rejected.
     */
    public function test_duplicate_skill_ids_in_request_are_rejected(): void
    {
        $user = User::factory()->create();
        $skill = Skill::first();

        $response = $this->actingAs($user)->postJson(route('profile.skills.update'), [
            'ratings' => [
                ['skill_id' => $skill->id, 'rating' => 2],
                ['skill_id' => $skill->id, 'rating' => 3],
            ],
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['ratings.0.skill_id', 'ratings.1.skill_id']);
    }

    /**
     * Test 10: Partial Updates Preserve Omitted Ratings.
     */
    public function test_partial_updates_preserve_omitted_ratings(): void
    {
        $user = User::factory()->create();
        $skills = Skill::take(3)->get();

        // Initially rate skill 0 and skill 1
        UserSkillRating::create(['user_id' => $user->id, 'skill_id' => $skills[0]->id, 'rating' => 2]);
        UserSkillRating::create(['user_id' => $user->id, 'skill_id' => $skills[1]->id, 'rating' => 3]);

        // Submit update for only skill 2
        $response = $this->actingAs($user)->postJson(route('profile.skills.update'), [
            'ratings' => [
                ['skill_id' => $skills[2]->id, 'rating' => 4],
            ],
        ]);

        $response->assertOk();
        $this->assertDatabaseHas('user_skill_ratings', ['user_id' => $user->id, 'skill_id' => $skills[0]->id, 'rating' => 2]);
        $this->assertDatabaseHas('user_skill_ratings', ['user_id' => $user->id, 'skill_id' => $skills[1]->id, 'rating' => 3]);
        $this->assertDatabaseHas('user_skill_ratings', ['user_id' => $user->id, 'skill_id' => $skills[2]->id, 'rating' => 4]);
    }

    /**
     * Test 11: Explicit Null Clears Existing Rating Back to Unrated.
     */
    public function test_explicit_null_clears_existing_rating(): void
    {
        $user = User::factory()->create();
        $skill = Skill::first();

        UserSkillRating::create(['user_id' => $user->id, 'skill_id' => $skill->id, 'rating' => 2]);
        $this->assertDatabaseHas('user_skill_ratings', ['user_id' => $user->id, 'skill_id' => $skill->id]);

        $response = $this->actingAs($user)->postJson(route('profile.skills.update'), [
            'ratings' => [
                ['skill_id' => $skill->id, 'rating' => null],
            ],
        ]);

        $response->assertOk();
        $this->assertDatabaseMissing('user_skill_ratings', ['user_id' => $user->id, 'skill_id' => $skill->id]);
    }

    /**
     * Test 12: Rating All 18 Skills Sets Completion Timestamp and Status.
     */
    public function test_rating_all_eighteen_skills_marks_assessment_complete(): void
    {
        $user = User::factory()->create([
            'skill_assessment_completed_at' => null,
        ]);
        $allSkills = Skill::all();
        $this->assertCount(18, $allSkills);

        $payload = $allSkills->map(fn ($s, $idx) => [
            'skill_id' => $s->id,
            'rating' => $idx % 5, // Mix of 0, 1, 2, 3, 4
        ])->all();

        $response = $this->actingAs($user)->postJson(route('profile.skills.update'), [
            'ratings' => $payload,
        ]);

        $response->assertOk();
        $user->refresh();
        $this->assertTrue($user->hasCompletedSkillAssessment());
        $this->assertNotNull($user->skill_assessment_completed_at);
        $this->assertTrue($user->hasAcknowledgedSkillOnboarding());
    }

    /**
     * Test 13: Clearing a Rating From Completed Assessment Resets Completion Timestamp.
     */
    public function test_clearing_a_rating_from_completed_assessment_resets_completion(): void
    {
        $user = User::factory()->create();
        $allSkills = Skill::all();

        // Pre-rate all 18 skills
        foreach ($allSkills as $skill) {
            UserSkillRating::create([
                'user_id' => $user->id,
                'skill_id' => $skill->id,
                'rating' => 3,
            ]);
        }
        $user->forceFill([
            'skill_onboarding_acknowledged_at' => now(),
            'skill_assessment_completed_at' => now(),
        ])->save();

        $this->assertTrue($user->hasCompletedSkillAssessment());

        // Clear one skill
        $response = $this->actingAs($user)->postJson(route('profile.skills.update'), [
            'ratings' => [
                ['skill_id' => $allSkills->first()->id, 'rating' => null],
            ],
        ]);

        $response->assertOk();
        $user->refresh();
        $this->assertFalse($user->hasCompletedSkillAssessment());
        $this->assertNull($user->skill_assessment_completed_at);
        // Acknowledgement remains intact!
        $this->assertTrue($user->hasAcknowledgedSkillOnboarding());
    }

    /**
     * Test 14: User Cannot Update Another User's Profile.
     */
    public function test_user_cannot_update_another_users_profile(): void
    {
        $user1 = User::factory()->create();
        $user2 = User::factory()->create();
        $skill = Skill::first();

        // Even if client attempts to pass user_id or target_user_id in payload, server operates on Auth::user()
        $this->actingAs($user1)->postJson(route('profile.skills.update'), [
            'user_id' => $user2->id,
            'ratings' => [
                ['skill_id' => $skill->id, 'rating' => 4],
            ],
        ]);

        // User1 is updated, User2 is untouched
        $this->assertDatabaseHas('user_skill_ratings', ['user_id' => $user1->id, 'skill_id' => $skill->id, 'rating' => 4]);
        $this->assertDatabaseMissing('user_skill_ratings', ['user_id' => $user2->id, 'skill_id' => $skill->id]);
    }

    /**
     * Test 15: Unauthenticated Access is Rejected.
     */
    public function test_unauthenticated_access_is_rejected(): void
    {
        $response = $this->get(route('profile.skills'));
        $response->assertRedirect(route('login'));

        $responseJson = $this->postJson(route('profile.skills.update'), ['ratings' => []]);
        $responseJson->assertStatus(401);
    }

    /**
     * Test 16: Questionnaire Returns Exact Categories, Skill Counts, and Assessment Statements.
     */
    public function test_questionnaire_returns_exact_categories_and_skills_and_statements(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->get(route('profile.skills'));
        $response->assertOk();

        $response->assertInertia(fn ($page) => $page
            ->component('Profile/Skills')
            ->has('categories', 4)
            ->where('categories.0.name', 'Documentation and Reporting')
            ->has('categories.0.skills', 7)
            ->where('categories.0.skills.0.name', 'Criteria and Evidence Review')
            ->where('categories.0.skills.0.statement', 'I can interpret requirements and determine whether supporting documents satisfy them.')
            ->where('categories.1.name', 'Event Coordination')
            ->has('categories.1.skills', 3)
            ->where('categories.1.skills.0.name', 'Event and Activity Planning')
            ->where('categories.2.name', 'Presentation and Communication')
            ->has('categories.2.skills', 3)
            ->where('categories.2.skills.0.name', 'Presenting and Responding to Queries')
            ->where('categories.3.name', 'Media and Technical')
            ->has('categories.3.skills', 5)
            ->where('categories.3.skills.0.name', 'Graphic Design and Layout')
            ->where('total_skills', 18)
        );
    }

    /**
     * Test 17: Revisiting Old Verification Link by Already Verified User Does Not Trigger Onboarding.
     */
    public function test_revisiting_old_verification_link_does_not_trigger_onboarding(): void
    {
        $user = User::factory()->create([
            'email_verified_at' => now()->subDays(5),
            'skill_onboarding_acknowledged_at' => null, // Never acknowledged
        ]);

        $signedUrl = \Illuminate\Support\Facades\URL::temporarySignedRoute(
            'verification.verify',
            now()->addMinutes(60),
            ['id' => $user->id, 'hash' => sha1($user->getEmailForVerification())]
        );

        $response = $this->actingAs($user)->get($signedUrl);

        // Because the user was already verified, they are routed to dashboard, not onboarding
        $response->assertRedirect(route('dashboard'));
    }

    /**
     * Test 18: Unverified Account Cannot Access Profile or Onboarding.
     */
    public function test_unverified_account_cannot_access_profile_or_onboarding(): void
    {
        $user = User::factory()->unverified()->create();

        $response1 = $this->actingAs($user)->get(route('profile.skills'));
        $response1->assertRedirect(route('verification.notice'));

        $response2 = $this->actingAs($user)->get(route('onboarding.skills'));
        $response2->assertRedirect(route('verification.notice'));
    }

    /**
     * Test 19: Complete Later Scenario A - Skip Immediately (Zero Ratings).
     */
    public function test_complete_later_scenario_a_skip_immediately(): void
    {
        $user = User::factory()->create([
            'skill_onboarding_acknowledged_at' => null,
        ]);

        $response = $this->actingAs($user)->post(route('onboarding.skills.complete-later'), [
            'ratings' => [],
        ]);

        $response->assertRedirect(route('dashboard'));
        $user->refresh();
        $this->assertTrue($user->hasAcknowledgedSkillOnboarding());
        $this->assertFalse($user->hasCompletedSkillAssessment());
        $this->assertEquals(0, UserSkillRating::where('user_id', $user->id)->count());
    }

    /**
     * Test 20: Complete Later Scenario B - Partial First Category.
     */
    public function test_complete_later_scenario_b_partial_first_category(): void
    {
        $user = User::factory()->create([
            'skill_onboarding_acknowledged_at' => null,
        ]);
        $skills = Skill::take(3)->get();

        $response = $this->actingAs($user)->post(route('onboarding.skills.complete-later'), [
            'ratings' => [
                ['skill_id' => $skills[0]->id, 'rating' => 2],
                ['skill_id' => $skills[1]->id, 'rating' => 0],
                ['skill_id' => $skills[2]->id, 'rating' => 4],
            ],
        ]);

        $response->assertRedirect(route('dashboard'));
        $user->refresh();
        $this->assertTrue($user->hasAcknowledgedSkillOnboarding());
        $this->assertFalse($user->hasCompletedSkillAssessment());
        $this->assertEquals(3, UserSkillRating::where('user_id', $user->id)->count());
        $this->assertDatabaseHas('user_skill_ratings', ['user_id' => $user->id, 'skill_id' => $skills[1]->id, 'rating' => 0]);
    }

    /**
     * Test 21: Complete Later Scenario C - Multiple Categories Preserves Previous and Unsaved.
     */
    public function test_complete_later_scenario_c_multiple_categories(): void
    {
        $user = User::factory()->create([
            'skill_onboarding_acknowledged_at' => null,
        ]);
        $skills = Skill::take(4)->get();

        // 1. Saved category 1 (skill 0 and 1)
        UserSkillRating::create(['user_id' => $user->id, 'skill_id' => $skills[0]->id, 'rating' => 3]);
        UserSkillRating::create(['user_id' => $user->id, 'skill_id' => $skills[1]->id, 'rating' => 1]);

        // 2. Select Complete Later with skill 2 rated as 4
        $response = $this->actingAs($user)->post(route('onboarding.skills.complete-later'), [
            'ratings' => [
                ['skill_id' => $skills[0]->id, 'rating' => 3],
                ['skill_id' => $skills[1]->id, 'rating' => 1],
                ['skill_id' => $skills[2]->id, 'rating' => 4],
            ],
        ]);

        $response->assertRedirect(route('dashboard'));
        $user->refresh();
        $this->assertTrue($user->hasAcknowledgedSkillOnboarding());
        $this->assertEquals(3, UserSkillRating::where('user_id', $user->id)->count());
        $this->assertDatabaseHas('user_skill_ratings', ['user_id' => $user->id, 'skill_id' => $skills[0]->id, 'rating' => 3]);
        $this->assertDatabaseHas('user_skill_ratings', ['user_id' => $user->id, 'skill_id' => $skills[2]->id, 'rating' => 4]);
        // Unrelated skills remain untouched
        $this->assertDatabaseMissing('user_skill_ratings', ['user_id' => $user->id, 'skill_id' => $skills[3]->id]);
    }

    /**
     * Test 22: Complete Later Scenario D - Save Failure / Validation Error.
     */
    public function test_complete_later_scenario_d_save_failure(): void
    {
        $user = User::factory()->create([
            'skill_onboarding_acknowledged_at' => null,
        ]);

        $response = $this->actingAs($user)->postJson(route('onboarding.skills.complete-later'), [
            'ratings' => [
                ['skill_id' => 99999, 'rating' => 5], // Invalid skill ID and rating
            ],
        ]);

        $response->assertStatus(422);
        $user->refresh();
        $this->assertFalse($user->hasAcknowledgedSkillOnboarding());
        $this->assertEquals(0, UserSkillRating::where('user_id', $user->id)->count());
    }

    /**
     * Test 23: Complete Later Scenario E - Explicit Zero is Preserved.
     */
    public function test_complete_later_scenario_e_explicit_zero(): void
    {
        $user = User::factory()->create([
            'skill_onboarding_acknowledged_at' => null,
        ]);
        $skill = Skill::first();

        $response = $this->actingAs($user)->post(route('onboarding.skills.complete-later'), [
            'ratings' => [
                ['skill_id' => $skill->id, 'rating' => 0],
            ],
        ]);

        $response->assertRedirect(route('dashboard'));
        $user->refresh();
        $this->assertTrue($user->hasAcknowledgedSkillOnboarding());
        $this->assertDatabaseHas('user_skill_ratings', [
            'user_id' => $user->id,
            'skill_id' => $skill->id,
            'rating' => 0,
        ]);
    }

    /**
     * Test 24: Editing a Completed Profile Preserves Existing Completion Timestamp.
     */
    public function test_editing_completed_profile_preserves_existing_completion_timestamp(): void
    {
        $user = User::factory()->create();
        $allSkills = Skill::all();

        foreach ($allSkills as $skill) {
            UserSkillRating::create([
                'user_id' => $user->id,
                'skill_id' => $skill->id,
                'rating' => 2,
            ]);
        }

        $originalTimestamp = now()->subDays(2)->startOfSecond();
        $user->forceFill([
            'skill_onboarding_acknowledged_at' => $originalTimestamp,
            'skill_assessment_completed_at' => $originalTimestamp,
        ])->save();

        // Update one skill to rating 4 (still all 18 rated)
        $response = $this->actingAs($user)->postJson(route('profile.skills.update'), [
            'ratings' => [
                ['skill_id' => $allSkills->first()->id, 'rating' => 4],
            ],
        ]);

        $response->assertOk();
        $user->refresh();
        $this->assertTrue($user->hasCompletedSkillAssessment());
        // Exact original timestamp is preserved without overwrite!
        $this->assertEquals(
            $originalTimestamp->toIso8601String(),
            $user->skill_assessment_completed_at->toIso8601String()
        );
    }

    /**
     * Test 25: Re-completing an Assessment Sets a New Timestamp.
     */
    public function test_recompleting_assessment_sets_new_timestamp(): void
    {
        $user = User::factory()->create();
        $allSkills = Skill::all();

        // Rate 17 skills
        foreach ($allSkills->slice(1) as $skill) {
            UserSkillRating::create([
                'user_id' => $user->id,
                'skill_id' => $skill->id,
                'rating' => 2,
            ]);
        }
        $user->forceFill([
            'skill_onboarding_acknowledged_at' => now()->subDay(),
            'skill_assessment_completed_at' => null, // Incomplete
        ])->save();

        // Now rate the remaining 18th skill
        $response = $this->actingAs($user)->postJson(route('profile.skills.update'), [
            'ratings' => [
                ['skill_id' => $allSkills->first()->id, 'rating' => 3],
            ],
        ]);

        $response->assertOk();
        $user->refresh();
        $this->assertTrue($user->hasCompletedSkillAssessment());
        $this->assertNotNull($user->skill_assessment_completed_at);
    }

    /**
     * Test 26: Invalid Rating Types (Boolean, Float, String) are Strictly Rejected.
     */
    public function test_invalid_rating_types_are_strictly_rejected(): void
    {
        $user = User::factory()->create();
        $skill = Skill::first();

        // Test boolean true
        $resBool = $this->actingAs($user)->postJson(route('profile.skills.update'), [
            'ratings' => [
                ['skill_id' => $skill->id, 'rating' => true],
            ],
        ]);
        $resBool->assertStatus(422);

        // Test float 2.5
        $resFloat = $this->actingAs($user)->postJson(route('profile.skills.update'), [
            'ratings' => [
                ['skill_id' => $skill->id, 'rating' => 2.5],
            ],
        ]);
        $resFloat->assertStatus(422);

        // Test non-digit string 'advanced'
        $resStr = $this->actingAs($user)->postJson(route('profile.skills.update'), [
            'ratings' => [
                ['skill_id' => $skill->id, 'rating' => 'advanced'],
            ],
        ]);
        $resStr->assertStatus(422);
    }

    /**
     * Test 27: Numeric String Rating is Accepted and Normalized to Integer.
     */
    public function test_numeric_string_rating_is_accepted_and_normalized(): void
    {
        $user = User::factory()->create();
        $skill = Skill::first();

        $response = $this->actingAs($user)->postJson(route('profile.skills.update'), [
            'ratings' => [
                ['skill_id' => $skill->id, 'rating' => '3'],
            ],
        ]);

        $response->assertOk();
        $this->assertDatabaseHas('user_skill_ratings', [
            'user_id' => $user->id,
            'skill_id' => $skill->id,
            'rating' => 3,
        ]);
    }

    /**
     * Test 28: Incomplete Catalog Does Not Produce False Completion.
     */
    public function test_incomplete_catalog_does_not_produce_false_completion(): void
    {
        $user = User::factory()->create();
        
        // Artificially delete 3 skills to simulate incomplete catalog (< 18)
        $skillsToDelete = Skill::take(3)->get();
        foreach ($skillsToDelete as $skill) {
            $skill->delete();
        }

        $remainingSkills = Skill::all();
        $this->assertLessThan(18, $remainingSkills->count());

        // User rates all remaining skills
        $payload = $remainingSkills->map(fn ($s) => ['skill_id' => $s->id, 'rating' => 3])->all();

        $response = $this->actingAs($user)->postJson(route('profile.skills.update'), [
            'ratings' => $payload,
        ]);

        $response->assertOk();
        $user->refresh();
        // Incomplete catalog must not mark assessment complete
        $this->assertFalse($user->hasCompletedSkillAssessment());
        $this->assertNull($user->skill_assessment_completed_at);
    }
}
