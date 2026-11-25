<?php

namespace Tests\Feature;

use App\Models\Activity;
use App\Models\Committee;
use App\Models\DeliverableSkillRequirement;
use App\Models\Project;
use App\Models\Skill;
use App\Models\SkillCategory;
use App\Models\Task;
use App\Models\TaskSkillRequirement;
use App\Models\User;
use App\Models\UserSkillRating;
use Database\Seeders\StandardizedSkillsSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SkillDatabaseFoundationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(StandardizedSkillsSeeder::class);
    }

    protected function createProjectWithCommittee(User $leader): array
    {
        $project = Project::create([
            'title' => 'Project ' . uniqid(),
            'description' => 'Test project description.',
            'status' => 'Planning',
            'created_by' => $leader->id,
        ]);

        $committee = Committee::create([
            'project_id' => $project->id,
            'name' => 'Committee ' . uniqid(),
        ]);

        return [$project, $committee];
    }

    /**
     * Test 1: Standardized Catalog Structure and Seeding.
     */
    public function test_standardized_catalog_has_exact_categories_and_skills(): void
    {
        $this->assertDatabaseCount('skill_categories', 4);
        $this->assertDatabaseCount('skills', 18);

        $expectedCategories = [
            'Documentation and Reporting',
            'Event Coordination',
            'Presentation and Communication',
            'Media and Technical',
        ];

        foreach ($expectedCategories as $categoryName) {
            $this->assertDatabaseHas('skill_categories', ['name' => $categoryName]);
        }

        // Check specific skills in each category
        $docCategory = SkillCategory::where('name', 'Documentation and Reporting')->first();
        $this->assertNotNull($docCategory);
        $this->assertCount(7, $docCategory->skills);
        $this->assertDatabaseHas('skills', [
            'category_id' => $docCategory->id,
            'code' => 'criteria_and_evidence_review',
            'name' => 'Criteria and Evidence Review',
            'statement' => 'I can interpret requirements and determine whether supporting documents satisfy them.',
            'display_order' => 1,
        ]);

        $eventCategory = SkillCategory::where('name', 'Event Coordination')->first();
        $this->assertNotNull($eventCategory);
        $this->assertCount(3, $eventCategory->skills);

        $presCategory = SkillCategory::where('name', 'Presentation and Communication')->first();
        $this->assertNotNull($presCategory);
        $this->assertCount(3, $presCategory->skills);

        $mediaCategory = SkillCategory::where('name', 'Media and Technical')->first();
        $this->assertNotNull($mediaCategory);
        $this->assertCount(5, $mediaCategory->skills);
    }

    /**
     * Test 2: Seeder Idempotency and Data Preservation.
     */
    public function test_seeder_is_idempotent_and_preserves_existing_ratings_and_requirements(): void
    {
        $user = User::factory()->create();
        $skill = Skill::first();

        // Add a user rating
        $rating = UserSkillRating::create([
            'user_id' => $user->id,
            'skill_id' => $skill->id,
            'rating' => 3,
        ]);

        // Re-run the seeder
        $this->seed(StandardizedSkillsSeeder::class);

        $this->assertDatabaseCount('skill_categories', 4);
        $this->assertDatabaseCount('skills', 18);
        $this->assertDatabaseHas('user_skill_ratings', [
            'id' => $rating->id,
            'user_id' => $user->id,
            'skill_id' => $skill->id,
            'rating' => 3,
        ]);
    }

    /**
     * Test 3: User Skill Ratings - Valid Range 0 to 4.
     */
    public function test_user_can_have_rating_zero_and_four(): void
    {
        $user = User::factory()->create();
        $skills = Skill::take(2)->get();

        $rating0 = UserSkillRating::create([
            'user_id' => $user->id,
            'skill_id' => $skills[0]->id,
            'rating' => 0,
        ]);

        $rating4 = UserSkillRating::create([
            'user_id' => $user->id,
            'skill_id' => $skills[1]->id,
            'rating' => 4,
        ]);

        $this->assertEquals(0, $rating0->fresh()->rating);
        $this->assertEquals(4, $rating4->fresh()->rating);
        $this->assertDatabaseCount('user_skill_ratings', 2);
    }

    /**
     * Test 4: User Skill Ratings - Reject Negative Ratings via CHECK constraint.
     */
    public function test_negative_rating_is_rejected_by_check_constraint(): void
    {
        $this->expectException(QueryException::class);

        $user = User::factory()->create();
        $skill = Skill::first();

        UserSkillRating::create([
            'user_id' => $user->id,
            'skill_id' => $skill->id,
            'rating' => -1,
        ]);
    }

    /**
     * Test 5: User Skill Ratings - Reject Ratings Above 4 via CHECK constraint.
     */
    public function test_rating_above_four_is_rejected_by_check_constraint(): void
    {
        $this->expectException(QueryException::class);

        $user = User::factory()->create();
        $skill = Skill::first();

        UserSkillRating::create([
            'user_id' => $user->id,
            'skill_id' => $skill->id,
            'rating' => 5,
        ]);
    }

    /**
     * Test 6: User Skill Ratings - Reject Duplicate User-Skill Pair via UNIQUE constraint.
     */
    public function test_duplicate_user_skill_rating_is_rejected(): void
    {
        $this->expectException(QueryException::class);

        $user = User::factory()->create();
        $skill = Skill::first();

        UserSkillRating::create([
            'user_id' => $user->id,
            'skill_id' => $skill->id,
            'rating' => 2,
        ]);

        UserSkillRating::create([
            'user_id' => $user->id,
            'skill_id' => $skill->id,
            'rating' => 3,
        ]);
    }

    /**
     * Test 7: User Skill Ratings - Existing Ratings Can Be Updated without Duplication.
     */
    public function test_user_rating_can_be_updated_without_duplication(): void
    {
        $user = User::factory()->create();
        $skill = Skill::first();

        $rating = UserSkillRating::create([
            'user_id' => $user->id,
            'skill_id' => $skill->id,
            'rating' => 1,
        ]);

        $rating->update(['rating' => 3]);

        $this->assertDatabaseCount('user_skill_ratings', 1);
        $this->assertEquals(3, $rating->fresh()->rating);
    }

    /**
     * Test 8: User Skill Ratings - Unrated Skills Have No Record.
     */
    public function test_unrated_skills_have_no_database_record(): void
    {
        $user = User::factory()->create();
        $skills = Skill::take(2)->get();

        UserSkillRating::create([
            'user_id' => $user->id,
            'skill_id' => $skills[0]->id,
            'rating' => 2,
        ]);

        $this->assertTrue($user->skillRatings()->where('skill_id', $skills[0]->id)->exists());
        $this->assertFalse($user->skillRatings()->where('skill_id', $skills[1]->id)->exists());
    }

    /**
     * Test 9: Deliverable Skill Requirements - Valid Minimum Ratings (1-4).
     */
    public function test_deliverable_skill_requirements_accept_valid_ratings(): void
    {
        $user = User::factory()->create();
        [$project, $committee] = $this->createProjectWithCommittee($user);
        $activity = Activity::create([
            'project_id' => $project->id,
            'committee_id' => $committee->id,
            'created_by' => $user->id,
            'title' => 'Sample Deliverable Activity',
            'status' => 'To Do',
        ]);
        $skill = Skill::first();

        $req = DeliverableSkillRequirement::create([
            'activity_id' => $activity->id,
            'skill_id' => $skill->id,
            'minimum_rating' => 3,
        ]);

        $this->assertDatabaseHas('deliverable_skill_requirements', [
            'id' => $req->id,
            'activity_id' => $activity->id,
            'minimum_rating' => 3,
        ]);
    }

    /**
     * Test 10: Deliverable Skill Requirements - Reject Minimum Rating 0 via CHECK constraint.
     */
    public function test_deliverable_skill_requirement_rejects_zero(): void
    {
        $this->expectException(QueryException::class);

        $user = User::factory()->create();
        [$project, $committee] = $this->createProjectWithCommittee($user);
        $activity = Activity::create([
            'project_id' => $project->id,
            'committee_id' => $committee->id,
            'created_by' => $user->id,
            'title' => 'Sample Deliverable Activity',
            'status' => 'To Do',
        ]);
        $skill = Skill::first();

        DeliverableSkillRequirement::create([
            'activity_id' => $activity->id,
            'skill_id' => $skill->id,
            'minimum_rating' => 0,
        ]);
    }

    /**
     * Test 11: Task Skill Requirements - Reject Minimum Rating Above 4.
     */
    public function test_task_skill_requirement_rejects_above_four(): void
    {
        $this->expectException(QueryException::class);

        $user = User::factory()->create();
        [$project, $committee] = $this->createProjectWithCommittee($user);
        $activity = Activity::create([
            'project_id' => $project->id,
            'committee_id' => $committee->id,
            'created_by' => $user->id,
            'title' => 'Sample Deliverable Activity',
            'status' => 'To Do',
        ]);
        $task = Task::create([
            'activity_id' => $activity->id,
            'title' => 'Sample Task',
            'status' => 'To Do',
        ]);
        $skill = Skill::first();

        TaskSkillRequirement::create([
            'task_id' => $task->id,
            'skill_id' => $skill->id,
            'minimum_rating' => 5,
        ]);
    }

    /**
     * Test 12: Deliverable and Task Requirements Remain Distinct.
     */
    public function test_deliverable_and_task_requirements_remain_separate(): void
    {
        $user = User::factory()->create();
        [$project, $committee] = $this->createProjectWithCommittee($user);
        $activity = Activity::create([
            'project_id' => $project->id,
            'committee_id' => $committee->id,
            'created_by' => $user->id,
            'title' => 'Deliverable Activity',
            'status' => 'To Do',
        ]);
        $task = Task::create([
            'activity_id' => $activity->id,
            'title' => 'Sub Task',
            'status' => 'To Do',
        ]);

        $skills = Skill::take(2)->get();

        $delivReq = DeliverableSkillRequirement::create([
            'activity_id' => $activity->id,
            'skill_id' => $skills[0]->id,
            'minimum_rating' => 2,
        ]);

        $taskReq = TaskSkillRequirement::create([
            'task_id' => $task->id,
            'skill_id' => $skills[1]->id,
            'minimum_rating' => 3,
        ]);

        $this->assertCount(1, $activity->fresh()->skillRequirements);
        $this->assertCount(1, $task->fresh()->skillRequirements);
        $this->assertEquals($skills[0]->id, $activity->fresh()->skillRequirements->first()->skill_id);
        $this->assertEquals($skills[1]->id, $task->fresh()->skillRequirements->first()->skill_id);
    }

    /**
     * Test 13: Onboarding State Persistence on User.
     */
    public function test_onboarding_state_fields_are_nullable_and_independently_set(): void
    {
        $user = User::factory()->create();

        $this->assertNull($user->skill_onboarding_acknowledged_at);
        $this->assertNull($user->skill_assessment_completed_at);
        $this->assertFalse($user->hasAcknowledgedSkillOnboarding());
        $this->assertFalse($user->hasCompletedSkillAssessment());

        // Acknowledge without complete (e.g. Complete Later)
        $user->forceFill(['skill_onboarding_acknowledged_at' => now()])->save();
        $user->refresh();

        $this->assertTrue($user->hasAcknowledgedSkillOnboarding());
        $this->assertFalse($user->hasCompletedSkillAssessment());

        // Mark completed
        $user->forceFill(['skill_assessment_completed_at' => now()])->save();
        $user->refresh();

        $this->assertTrue($user->hasAcknowledgedSkillOnboarding());
        $this->assertTrue($user->hasCompletedSkillAssessment());
    }

    /**
     * Test 14: Eloquent Model Relationships on User, Skill, Activity, and Task.
     */
    public function test_model_relationships_work_correctly(): void
    {
        $user = User::factory()->create();
        $skill = Skill::first();

        UserSkillRating::create([
            'user_id' => $user->id,
            'skill_id' => $skill->id,
            'rating' => 3,
        ]);

        $this->assertEquals(1, $user->skillRatings->count());
        $this->assertEquals(1, $user->skills->count());
        $this->assertEquals(3, $user->skills->first()->pivot->rating);

        $this->assertEquals(1, $skill->ratings->count());
        $this->assertEquals($user->id, $skill->ratings->first()->user_id);
        $this->assertInstanceOf(SkillCategory::class, $skill->category);
    }

    /**
     * Test 15: Duplicate Deliverable Skill Requirement is Rejected.
     */
    public function test_duplicate_deliverable_skill_requirement_is_rejected(): void
    {
        $this->expectException(QueryException::class);

        $user = User::factory()->create();
        [$project, $committee] = $this->createProjectWithCommittee($user);
        $activity = Activity::create([
            'project_id' => $project->id,
            'committee_id' => $committee->id,
            'created_by' => $user->id,
            'title' => 'Deliverable Activity',
            'status' => 'To Do',
        ]);
        $skill = Skill::first();

        DeliverableSkillRequirement::create([
            'activity_id' => $activity->id,
            'skill_id' => $skill->id,
            'minimum_rating' => 2,
        ]);

        DeliverableSkillRequirement::create([
            'activity_id' => $activity->id,
            'skill_id' => $skill->id,
            'minimum_rating' => 3,
        ]);
    }

    /**
     * Test 16: Duplicate Task Skill Requirement is Rejected.
     */
    public function test_duplicate_task_skill_requirement_is_rejected(): void
    {
        $this->expectException(QueryException::class);

        $user = User::factory()->create();
        [$project, $committee] = $this->createProjectWithCommittee($user);
        $activity = Activity::create([
            'project_id' => $project->id,
            'committee_id' => $committee->id,
            'created_by' => $user->id,
            'title' => 'Deliverable Activity',
            'status' => 'To Do',
        ]);
        $task = Task::create([
            'activity_id' => $activity->id,
            'title' => 'Sub Task',
            'status' => 'To Do',
        ]);
        $skill = Skill::first();

        TaskSkillRequirement::create([
            'task_id' => $task->id,
            'skill_id' => $skill->id,
            'minimum_rating' => 2,
        ]);

        TaskSkillRequirement::create([
            'task_id' => $task->id,
            'skill_id' => $skill->id,
            'minimum_rating' => 3,
        ]);
    }

    /**
     * Test 17: Invalid Foreign Keys in Ratings are Rejected.
     */
    public function test_invalid_foreign_keys_in_ratings_are_rejected(): void
    {
        $this->expectException(QueryException::class);

        $user = User::factory()->create();

        UserSkillRating::create([
            'user_id' => $user->id,
            'skill_id' => 999999, // Non-existent skill
            'rating' => 2,
        ]);
    }

    /**
     * Test 18: Invalid Foreign Keys in Requirements are Rejected.
     */
    public function test_invalid_foreign_keys_in_requirements_are_rejected(): void
    {
        $this->expectException(QueryException::class);

        TaskSkillRequirement::create([
            'task_id' => 999999, // Non-existent task
            'skill_id' => 1,
            'minimum_rating' => 2,
        ]);
    }

    /**
     * Test 19: Valid Minimum Proficiency Boundaries of 1 and 4 for Requirements.
     */
    public function test_minimum_proficiency_boundaries_one_and_four_are_valid(): void
    {
        $user = User::factory()->create();
        [$project, $committee] = $this->createProjectWithCommittee($user);
        $activity = Activity::create([
            'project_id' => $project->id,
            'committee_id' => $committee->id,
            'created_by' => $user->id,
            'title' => 'Activity',
            'status' => 'To Do',
        ]);
        $task = Task::create([
            'activity_id' => $activity->id,
            'title' => 'Task',
            'status' => 'To Do',
        ]);

        $skills = Skill::take(4)->get();

        $delivReq1 = DeliverableSkillRequirement::create([
            'activity_id' => $activity->id,
            'skill_id' => $skills[0]->id,
            'minimum_rating' => 1,
        ]);

        $delivReq4 = DeliverableSkillRequirement::create([
            'activity_id' => $activity->id,
            'skill_id' => $skills[1]->id,
            'minimum_rating' => 4,
        ]);

        $taskReq1 = TaskSkillRequirement::create([
            'task_id' => $task->id,
            'skill_id' => $skills[2]->id,
            'minimum_rating' => 1,
        ]);

        $taskReq4 = TaskSkillRequirement::create([
            'task_id' => $task->id,
            'skill_id' => $skills[3]->id,
            'minimum_rating' => 4,
        ]);

        $this->assertEquals(1, $delivReq1->fresh()->minimum_rating);
        $this->assertEquals(4, $delivReq4->fresh()->minimum_rating);
        $this->assertEquals(1, $taskReq1->fresh()->minimum_rating);
        $this->assertEquals(4, $taskReq4->fresh()->minimum_rating);
    }

    /**
     * Test 20: Invalid Minimum Proficiency Boundaries are Rejected.
     */
    public function test_invalid_minimum_proficiency_boundaries_are_rejected(): void
    {
        $this->expectException(QueryException::class);

        $user = User::factory()->create();
        [$project, $committee] = $this->createProjectWithCommittee($user);
        $activity = Activity::create([
            'project_id' => $project->id,
            'committee_id' => $committee->id,
            'created_by' => $user->id,
            'title' => 'Activity',
            'status' => 'To Do',
        ]);

        DeliverableSkillRequirement::create([
            'activity_id' => $activity->id,
            'skill_id' => 1,
            'minimum_rating' => 5, // Above 4
        ]);
    }

    /**
     * Test 21: Existing User Accounts Remain Compatible.
     */
    public function test_existing_user_accounts_remain_compatible(): void
    {
        $user = User::factory()->create([
            'name' => 'Existing Faculty',
            'email' => 'existing.faculty@carsu.edu.ph',
        ]);

        $this->assertNull($user->skill_onboarding_acknowledged_at);
        $this->assertNull($user->skill_assessment_completed_at);
        $this->assertEmpty($user->skillRatings);
        $this->assertFalse($user->hasAcknowledgedSkillOnboarding());
        $this->assertFalse($user->hasCompletedSkillAssessment());
    }

    /**
     * Test 22: Onboarding Timestamps are Guarded from Arbitrary Mass Assignment.
     */
    public function test_onboarding_timestamps_are_guarded_from_mass_assignment(): void
    {
        $user = User::create([
            'name' => 'Test User',
            'email' => 'test.massassign@carsu.edu.ph',
            'password' => bcrypt('password'),
            'skill_onboarding_acknowledged_at' => now(),
            'skill_assessment_completed_at' => now(),
        ]);

        // Guarded fields in $fillable are ignored on User::create
        $this->assertNull($user->fresh()->skill_onboarding_acknowledged_at);
        $this->assertNull($user->fresh()->skill_assessment_completed_at);
    }
}
