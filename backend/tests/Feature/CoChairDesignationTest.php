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

    // ─── 1. Event-level Co-Chair Tests ───────────────────────────────────────

    public function test_overall_chair_can_designate_event_participant_as_event_co_chair(): void
    {
        $response = $this->actingAs($this->leader)
            ->postJson("/projects/{$this->project->id}/co-chairs", [
                'user_id' => $this->member1->id,
            ]);

        $response->assertStatus(201);

        $this->assertDatabaseHas('co_chair_designations', [
            'project_id' => $this->project->id,
            'user_id' => $this->member1->id,
            'committee_id' => null,
            'designated_by' => $this->leader->id,
        ]);

        // Primary role assignment remains intact
        $this->assertDatabaseHas('project_role_assignments', [
            'project_id' => $this->project->id,
            'user_id' => $this->member1->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_MEMBER,
        ]);
    }

    public function test_overall_chair_can_revoke_event_co_chair_designation(): void
    {
        CoChairDesignation::create([
            'project_id' => $this->project->id,
            'user_id' => $this->member1->id,
            'committee_id' => null,
            'designated_by' => $this->leader->id,
        ]);

        $response = $this->actingAs($this->leader)
            ->deleteJson("/projects/{$this->project->id}/co-chairs/{$this->member1->id}");

        $response->assertStatus(200);

        $this->assertDatabaseMissing('co_chair_designations', [
            'project_id' => $this->project->id,
            'user_id' => $this->member1->id,
            'committee_id' => null,
        ]);

        // Underlying membership is NOT removed
        $this->assertDatabaseHas('project_role_assignments', [
            'project_id' => $this->project->id,
            'user_id' => $this->member1->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_MEMBER,
        ]);
    }

    public function test_non_leader_cannot_designate_event_co_chair(): void
    {
        $response = $this->actingAs($this->staff1)
            ->postJson("/projects/{$this->project->id}/co-chairs", [
                'user_id' => $this->member2->id,
            ]);

        $response->assertStatus(403);
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
            'user_id' => $this->member1->id,
            'committee_id' => null,
            'designated_by' => $this->leader->id,
        ]);

        $response = $this->actingAs($this->leader)
            ->postJson("/projects/{$this->project->id}/co-chairs", [
                'user_id' => $this->member1->id,
            ]);

        $response->assertStatus(422);
    }

    public function test_event_co_chair_has_event_wide_visibility_but_cannot_update_event_settings(): void
    {
        CoChairDesignation::create([
            'project_id' => $this->project->id,
            'user_id' => $this->member1->id,
            'committee_id' => null,
            'designated_by' => $this->leader->id,
        ]);

        // Can view project
        $this->actingAs($this->member1)
            ->get("/projects/{$this->project->id}")
            ->assertStatus(200);

        // Can view committee2 (even though member1 was only assigned to committee1)
        $this->actingAs($this->member1)
            ->get("/projects/{$this->project->id}/committees/{$this->committee2->id}")
            ->assertStatus(200);

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
}
