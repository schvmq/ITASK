<?php

namespace Tests\Feature;

use App\Models\Activity;
use App\Models\CoChairDesignation;
use App\Models\Committee;
use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CoChairDesignationTest extends TestCase
{
    use RefreshDatabase;

    private User $leader;
    private User $staff1;
    private User $member1;
    private User $member2;
    private User $outsider;

    private Project $project;
    private Committee $committee1;
    private Committee $committee2;
    private Activity $activity1;

    protected function setUp(): void
    {
        parent::setUp();

        $this->leader = User::factory()->create(['email_verified_at' => now()]);
        $this->staff1 = User::factory()->create(['email_verified_at' => now()]);
        $this->member1 = User::factory()->create(['email_verified_at' => now()]);
        $this->member2 = User::factory()->create(['email_verified_at' => now()]);
        $this->outsider = User::factory()->create(['email_verified_at' => now()]);

        $this->project = Project::create([
            'title' => 'Flagship Event 2026',
            'status' => Project::STATUS_ACTIVE,
            'created_by' => $this->leader->id,
        ]);

        ProjectRoleAssignment::create([
            'project_id' => $this->project->id,
            'user_id' => $this->leader->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_LEADER,
            'committee_id' => null,
        ]);

        $this->committee1 = Committee::create([
            'project_id' => $this->project->id,
            'name' => 'Logistics Committee',
        ]);

        $this->committee2 = Committee::create([
            'project_id' => $this->project->id,
            'name' => 'Program Committee',
        ]);

        // staff1 is Chairperson of committee1
        ProjectRoleAssignment::create([
            'project_id' => $this->project->id,
            'user_id' => $this->staff1->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_STAFF,
            'committee_id' => $this->committee1->id,
        ]);

        // member1 is Member of committee1
        ProjectRoleAssignment::create([
            'project_id' => $this->project->id,
            'user_id' => $this->member1->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_MEMBER,
            'committee_id' => $this->committee1->id,
        ]);

        // member2 is Member of committee2
        ProjectRoleAssignment::create([
            'project_id' => $this->project->id,
            'user_id' => $this->member2->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_MEMBER,
            'committee_id' => $this->committee2->id,
        ]);

        $this->activity1 = Activity::create([
            'project_id' => $this->project->id,
            'committee_id' => $this->committee1->id,
            'created_by' => $this->staff1->id,
            'title' => 'Venue Setup Deliverable',
            'status' => Activity::STATUS_IN_PROGRESS,
        ]);
    }

    // ─── 1. Event-level Co-Chair Tests ──────────────────────────────────────

    public function test_overall_chair_can_designate_event_participant_as_event_co_chair(): void
    {
        $response = $this->actingAs($this->leader)
            ->postJson("/projects/{$this->project->id}/co-chairs", [
                'user_id' => $this->member1->id,
            ]);

        $response->assertStatus(201);
        $this->assertStringContainsString('Event-level Co-Chair', $response->json('message'));

        $this->assertDatabaseHas('co_chair_designations', [
            'project_id' => $this->project->id,
            'committee_id' => null,
            'user_id' => $this->member1->id,
            'designated_by' => $this->leader->id,
        ]);
    }

    public function test_overall_chair_can_revoke_event_co_chair_designation(): void
    {
        CoChairDesignation::create([
            'project_id' => $this->project->id,
            'committee_id' => null,
            'user_id' => $this->member1->id,
            'designated_by' => $this->leader->id,
        ]);

        $response = $this->actingAs($this->leader)
            ->deleteJson("/projects/{$this->project->id}/co-chairs/{$this->member1->id}");

        $response->assertStatus(200);
        $this->assertStringContainsString('Event-level Co-Chair designation', $response->json('message'));

        $this->assertDatabaseMissing('co_chair_designations', [
            'project_id' => $this->project->id,
            'committee_id' => null,
            'user_id' => $this->member1->id,
        ]);
    }

    public function test_non_leader_cannot_designate_event_co_chair(): void
    {
        $this->actingAs($this->staff1)
            ->postJson("/projects/{$this->project->id}/co-chairs", [
                'user_id' => $this->member1->id,
            ])
            ->assertStatus(403);

        $this->actingAs($this->member1)
            ->postJson("/projects/{$this->project->id}/co-chairs", [
                'user_id' => $this->member2->id,
            ])
            ->assertStatus(403);
    }

    public function test_cannot_designate_non_participant_as_event_co_chair(): void
    {
        $response = $this->actingAs($this->leader)
            ->postJson("/projects/{$this->project->id}/co-chairs", [
                'user_id' => $this->outsider->id,
            ]);

        $response->assertStatus(422);
    }

    public function test_cannot_designate_overall_chair_as_event_co_chair(): void
    {
        $response = $this->actingAs($this->leader)
            ->postJson("/projects/{$this->project->id}/co-chairs", [
                'user_id' => $this->leader->id,
            ]);

        $response->assertStatus(422);
    }

    public function test_cannot_designate_duplicate_event_co_chair(): void
    {
        CoChairDesignation::create([
            'project_id' => $this->project->id,
            'committee_id' => null,
            'user_id' => $this->member1->id,
            'designated_by' => $this->leader->id,
        ]);

        $response = $this->actingAs($this->leader)
            ->postJson("/projects/{$this->project->id}/co-chairs", [
                'user_id' => $this->member1->id,
            ]);

        $response->assertStatus(422);
    }

    public function test_event_co_chair_has_event_wide_visibility_and_reminders_access_but_cannot_update_event_settings(): void
    {
        CoChairDesignation::create([
            'project_id' => $this->project->id,
            'committee_id' => null,
            'user_id' => $this->member2->id,
            'designated_by' => $this->leader->id,
        ]);

        // member2 is in committee2, but as Event Co-Chair can view committee1 and deliverables
        $this->actingAs($this->member2)
            ->get("/projects/{$this->project->id}/committees/{$this->committee1->id}")
            ->assertStatus(200);

        $this->actingAs($this->member2)
            ->get("/projects/{$this->project->id}/committees/{$this->committee1->id}/activities/{$this->activity1->id}")
            ->assertStatus(200);

        // CANNOT update project settings
        $this->actingAs($this->member2)
            ->put("/projects/{$this->project->id}", [
                'title' => 'Event Co-Chair Attempted Title',
                'description' => 'Test',
                'status' => Project::STATUS_ACTIVE,
            ])
            ->assertStatus(403);

        // CANNOT archive project
        $this->actingAs($this->member2)
            ->post("/projects/{$this->project->id}/archive")
            ->assertStatus(403);
    }

    public function test_committee_co_chair_does_not_receive_event_wide_management_privileges(): void
    {
        CoChairDesignation::create([
            'project_id' => $this->project->id,
            'committee_id' => $this->committee1->id,
            'user_id' => $this->member1->id,
            'designated_by' => $this->staff1->id,
        ]);

        // CANNOT update project settings
        $this->actingAs($this->member1)
            ->put("/projects/{$this->project->id}", [
                'title' => 'Hacked Title',
                'description' => 'Test',
                'status' => Project::STATUS_ACTIVE,
            ])
            ->assertStatus(403);

        // CANNOT archive project
        $this->actingAs($this->member1)
            ->post("/projects/{$this->project->id}/archive")
            ->assertStatus(403);
    }

    public function test_multiple_co_chairs_supported_in_committee(): void
    {
        $member3 = User::factory()->create(['email_verified_at' => now()]);
        ProjectRoleAssignment::create([
            'project_id' => $this->project->id,
            'user_id' => $member3->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_MEMBER,
            'committee_id' => $this->committee1->id,
        ]);

        // Designate member1
        $this->actingAs($this->staff1)
            ->postJson("/projects/{$this->project->id}/committees/{$this->committee1->id}/co-chairs", [
                'user_id' => $this->member1->id,
            ])
            ->assertStatus(201);

        // Designate member3 as second Co-Chair in the same committee
        $this->actingAs($this->staff1)
            ->postJson("/projects/{$this->project->id}/committees/{$this->committee1->id}/co-chairs", [
                'user_id' => $member3->id,
            ])
            ->assertStatus(201);

        $this->assertDatabaseHas('co_chair_designations', [
            'project_id' => $this->project->id,
            'committee_id' => $this->committee1->id,
            'user_id' => $this->member1->id,
        ]);

        $this->assertDatabaseHas('co_chair_designations', [
            'project_id' => $this->project->id,
            'committee_id' => $this->committee1->id,
            'user_id' => $member3->id,
        ]);

        $this->assertEquals(
            2,
            CoChairDesignation::where('project_id', $this->project->id)
                ->where('committee_id', $this->committee1->id)
                ->count()
        );
    }

    // ─── 2. Committee-level Co-Chair Tests ───────────────────────────────────

    public function test_chairperson_can_designate_committee_member_as_committee_co_chair(): void
    {
        $response = $this->actingAs($this->staff1)
            ->postJson("/projects/{$this->project->id}/committees/{$this->committee1->id}/co-chairs", [
                'user_id' => $this->member1->id,
            ]);

        $response->assertStatus(201);

        $this->assertDatabaseHas('co_chair_designations', [
            'project_id' => $this->project->id,
            'committee_id' => $this->committee1->id,
            'user_id' => $this->member1->id,
            'designated_by' => $this->staff1->id,
        ]);
    }

    public function test_chairperson_can_revoke_committee_co_chair_designation(): void
    {
        CoChairDesignation::create([
            'project_id' => $this->project->id,
            'committee_id' => $this->committee1->id,
            'user_id' => $this->member1->id,
            'designated_by' => $this->staff1->id,
        ]);

        $response = $this->actingAs($this->staff1)
            ->deleteJson("/projects/{$this->project->id}/committees/{$this->committee1->id}/co-chairs/{$this->member1->id}");

        $response->assertStatus(200);

        $this->assertDatabaseMissing('co_chair_designations', [
            'project_id' => $this->project->id,
            'committee_id' => $this->committee1->id,
            'user_id' => $this->member1->id,
        ]);

        // Underlying committee membership remains intact
        $this->assertDatabaseHas('project_role_assignments', [
            'project_id' => $this->project->id,
            'committee_id' => $this->committee1->id,
            'user_id' => $this->member1->id,
        ]);
    }

    public function test_regular_member_cannot_designate_committee_co_chair(): void
    {
        $response = $this->actingAs($this->member1)
            ->postJson("/projects/{$this->project->id}/committees/{$this->committee1->id}/co-chairs", [
                'user_id' => $this->member2->id,
            ]);

        $response->assertStatus(403);
    }

    public function test_cannot_designate_non_committee_member_as_committee_co_chair(): void
    {
        // member2 belongs to committee2, not committee1
        $response = $this->actingAs($this->staff1)
            ->postJson("/projects/{$this->project->id}/committees/{$this->committee1->id}/co-chairs", [
                'user_id' => $this->member2->id,
            ]);

        $response->assertStatus(422);
    }

    public function test_committee_co_chair_can_create_and_update_tasks_within_committee(): void
    {
        CoChairDesignation::create([
            'project_id' => $this->project->id,
            'committee_id' => $this->committee1->id,
            'user_id' => $this->member1->id,
            'designated_by' => $this->staff1->id,
        ]);

        // 1. Can create task
        $createResponse = $this->actingAs($this->member1)
            ->post("/projects/{$this->project->id}/committees/{$this->committee1->id}/activities/{$this->activity1->id}/tasks", [
                'title' => 'Chairs and Tables Task',
                'description' => 'Coordinate venue setup',
                'priority' => 'High',
            ]);

        $createResponse->assertStatus(302);
        $this->assertDatabaseHas('tasks', [
            'title' => 'Chairs and Tables Task',
            'activity_id' => $this->activity1->id,
        ]);

        $task = Task::where('title', 'Chairs and Tables Task')->firstOrFail();

        // 2. Can update task configuration
        $updateResponse = $this->actingAs($this->member1)
            ->put("/projects/{$this->project->id}/committees/{$this->committee1->id}/activities/{$this->activity1->id}/tasks/{$task->id}", [
                'title' => 'Updated Chairs and Tables Task',
                'description' => 'Updated desc',
                'priority' => 'Medium',
            ]);

        $updateResponse->assertStatus(302);
        $this->assertDatabaseHas('tasks', [
            'id' => $task->id,
            'title' => 'Updated Chairs and Tables Task',
        ]);
    }

    public function test_committee_co_chair_cannot_approve_deliverable(): void
    {
        CoChairDesignation::create([
            'project_id' => $this->project->id,
            'committee_id' => $this->committee1->id,
            'user_id' => $this->member1->id,
            'designated_by' => $this->staff1->id,
        ]);

        $this->activity1->update(['status' => Activity::STATUS_UNDER_REVIEW]);

        // Final deliverable review/approval is strictly reserved for the authorized Chairperson
        $response = $this->actingAs($this->member1)
            ->postJson("/projects/{$this->project->id}/committees/{$this->committee1->id}/activities/{$this->activity1->id}/review", [
                'decision' => 'Approved',
                'review_feedback' => 'Attempted approval by Co-Chair',
            ]);

        $response->assertStatus(403);
    }

    public function test_committee_co_chair_cannot_access_other_unrelated_committees(): void
    {
        CoChairDesignation::create([
            'project_id' => $this->project->id,
            'committee_id' => $this->committee1->id,
            'user_id' => $this->member1->id,
            'designated_by' => $this->staff1->id,
        ]);

        // member1 is Committee Co-Chair of committee1, has no role in committee2
        $response = $this->actingAs($this->member1)
            ->get("/projects/{$this->project->id}/committees/{$this->committee2->id}");

        $response->assertStatus(403);
    }

    // ─── 3. Committee Creation with Optional Chair and Co-Chair Tests ───────

    public function test_overall_chair_can_create_committee_with_chairperson_and_co_chair(): void
    {
        $response = $this->actingAs($this->leader)
            ->post("/projects/{$this->project->id}/committees", [
                'name' => 'Procurement Committee',
                'description' => 'Handles procurement and supplies.',
                'user_id' => $this->staff1->id,
                'co_chair_id' => $this->member1->id,
            ]);

        $response->assertRedirect();

        $committee = Committee::where('name', 'Procurement Committee')->firstOrFail();
        $this->assertEquals($this->project->id, $committee->project_id);

        // Chairperson assigned as Project Staff
        $this->assertDatabaseHas('project_role_assignments', [
            'project_id' => $this->project->id,
            'committee_id' => $committee->id,
            'user_id' => $this->staff1->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_STAFF,
        ]);

        // Co-Chair assigned as Project Member
        $this->assertDatabaseHas('project_role_assignments', [
            'project_id' => $this->project->id,
            'committee_id' => $committee->id,
            'user_id' => $this->member1->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_MEMBER,
        ]);

        // Co-Chair designation created for this committee
        $this->assertDatabaseHas('co_chair_designations', [
            'project_id' => $this->project->id,
            'committee_id' => $committee->id,
            'user_id' => $this->member1->id,
            'designated_by' => $this->leader->id,
        ]);
    }

    public function test_overall_chair_can_create_committee_without_chair_or_co_chair(): void
    {
        $response = $this->actingAs($this->leader)
            ->post("/projects/{$this->project->id}/committees", [
                'name' => 'Documentation Committee',
                'description' => 'Optional roles left empty.',
                'user_id' => null,
                'co_chair_id' => null,
            ]);

        $response->assertRedirect();

        $committee = Committee::where('name', 'Documentation Committee')->firstOrFail();

        // No assignments or designations for this committee
        $this->assertDatabaseMissing('project_role_assignments', [
            'committee_id' => $committee->id,
        ]);

        $this->assertDatabaseMissing('co_chair_designations', [
            'committee_id' => $committee->id,
        ]);
    }

    public function test_cannot_assign_same_user_as_both_chair_and_co_chair_on_creation(): void
    {
        $response = $this->actingAs($this->leader)
            ->postJson("/projects/{$this->project->id}/committees", [
                'name' => 'Invalid Double Assignment Committee',
                'user_id' => $this->member1->id,
                'co_chair_id' => $this->member1->id,
            ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['co_chair_id']);
    }

    public function test_cannot_assign_overall_chair_as_chair_or_co_chair_on_creation(): void
    {
        // 1. Cannot assign leader as chairperson
        $response1 = $this->actingAs($this->leader)
            ->postJson("/projects/{$this->project->id}/committees", [
                'name' => 'Leader as Chair Committee',
                'user_id' => $this->leader->id,
            ]);

        $response1->assertStatus(422);
        $response1->assertJsonValidationErrors(['user_id']);

        // 2. Cannot assign leader as co-chair
        $response2 = $this->actingAs($this->leader)
            ->postJson("/projects/{$this->project->id}/committees", [
                'name' => 'Leader as Co-Chair Committee',
                'co_chair_id' => $this->leader->id,
            ]);

        $response2->assertStatus(422);
        $response2->assertJsonValidationErrors(['co_chair_id']);
    }

    public function test_non_overall_chair_cannot_create_committee_or_assign_roles(): void
    {
        // Project Staff cannot create committee
        $this->actingAs($this->staff1)
            ->postJson("/projects/{$this->project->id}/committees", [
                'name' => 'Unauthorized Committee',
                'user_id' => $this->staff1->id,
            ])
            ->assertStatus(403);

        // Project Member cannot create committee
        $this->actingAs($this->member1)
            ->postJson("/projects/{$this->project->id}/committees", [
                'name' => 'Unauthorized Committee by Member',
            ])
            ->assertStatus(403);
    }

    public function test_event_co_chair_can_be_assigned_as_committee_chairperson_during_creation(): void
    {
        // Designate member2 as Event Co-Chair
        CoChairDesignation::create([
            'project_id' => $this->project->id,
            'user_id' => $this->member2->id,
            'committee_id' => null,
            'designated_by' => $this->leader->id,
        ]);

        $response = $this->actingAs($this->leader)
            ->post("/projects/{$this->project->id}/committees", [
                'name' => 'Event CoChair Led Committee',
                'description' => 'A committee where the Event Co-Chair is Chairperson',
                'user_id' => $this->member2->id,
            ]);

        $response->assertRedirect();

        $createdCommittee = Committee::where('name', 'Event CoChair Led Committee')->firstOrFail();

        // Verify member2 is assigned as Project Staff of this new committee
        $this->assertDatabaseHas('project_role_assignments', [
            'project_id' => $this->project->id,
            'committee_id' => $createdCommittee->id,
            'user_id' => $this->member2->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_STAFF,
        ]);

        // Verify member2 is STILL an Event Co-Chair
        $this->assertDatabaseHas('co_chair_designations', [
            'project_id' => $this->project->id,
            'user_id' => $this->member2->id,
            'committee_id' => null,
        ]);
    }

    public function test_event_co_chair_can_be_assigned_as_chairperson_of_existing_committee(): void
    {
        // Designate member2 as Event Co-Chair
        CoChairDesignation::create([
            'project_id' => $this->project->id,
            'user_id' => $this->member2->id,
            'committee_id' => null,
            'designated_by' => $this->leader->id,
        ]);

        $response = $this->actingAs($this->leader)
            ->put("/projects/{$this->project->id}/committees/{$this->committee1->id}", [
                'name' => 'Logistics Committee Updated',
                'user_id' => $this->member2->id,
            ]);

        $response->assertSessionHasNoErrors();

        // Verify member2 is now the staff/chairperson of committee1
        $this->assertDatabaseHas('project_role_assignments', [
            'project_id' => $this->project->id,
            'committee_id' => $this->committee1->id,
            'user_id' => $this->member2->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_STAFF,
        ]);

        // Verify member2 still holds their Event Co-Chair designation
        $this->assertDatabaseHas('co_chair_designations', [
            'project_id' => $this->project->id,
            'user_id' => $this->member2->id,
            'committee_id' => null,
        ]);
    }

    public function test_event_co_chair_can_be_assigned_as_committee_member(): void
    {
        // member2 is currently in committee2; designate them as Event Co-Chair
        CoChairDesignation::create([
            'project_id' => $this->project->id,
            'user_id' => $this->member2->id,
            'committee_id' => null,
            'designated_by' => $this->leader->id,
        ]);

        // Leader assigns member2 to committee1
        $response = $this->actingAs($this->leader)
            ->post("/projects/{$this->project->id}/committees/{$this->committee1->id}/members", [
                'user_id' => $this->member2->id,
            ]);

        $response->assertSessionHasNoErrors();

        // Verify member2 is now assigned to committee1
        $this->assertDatabaseHas('project_role_assignments', [
            'project_id' => $this->project->id,
            'committee_id' => $this->committee1->id,
            'user_id' => $this->member2->id,
        ]);

        // Verify member2 still holds their Event Co-Chair designation
        $this->assertDatabaseHas('co_chair_designations', [
            'project_id' => $this->project->id,
            'user_id' => $this->member2->id,
            'committee_id' => null,
        ]);
    }

    public function test_event_co_chair_can_also_be_designated_as_committee_co_chair(): void
    {
        // member1 is in committee1; designate member1 as Event Co-Chair
        CoChairDesignation::create([
            'project_id' => $this->project->id,
            'user_id' => $this->member1->id,
            'committee_id' => null,
            'designated_by' => $this->leader->id,
        ]);

        // Committee Staff designates member1 as Committee Co-Chair
        $response = $this->actingAs($this->staff1)
            ->postJson("/projects/{$this->project->id}/committees/{$this->committee1->id}/co-chairs", [
                'user_id' => $this->member1->id,
            ]);

        $response->assertStatus(201);

        // Verify user has Event-level Co-Chair designation
        $this->assertDatabaseHas('co_chair_designations', [
            'project_id' => $this->project->id,
            'user_id' => $this->member1->id,
            'committee_id' => null,
        ]);

        // Verify user ALSO has Committee-level Co-Chair designation
        $this->assertDatabaseHas('co_chair_designations', [
            'project_id' => $this->project->id,
            'user_id' => $this->member1->id,
            'committee_id' => $this->committee1->id,
        ]);
    }
}
