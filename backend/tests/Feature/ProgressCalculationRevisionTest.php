<?php

namespace Tests\Feature;

use App\Models\Activity;
use App\Models\Committee;
use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Models\Task;
use App\Models\User;
use App\Services\ProjectProgressService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProgressCalculationRevisionTest extends TestCase
{
    use RefreshDatabase;

    private ProjectProgressService $progressService;

    private User $leader;
    private User $staff1;
    private User $staff2;

    private Project $project;
    private Committee $committeeA;
    private Committee $committeeB;

    protected function setUp(): void
    {
        parent::setUp();

        $this->progressService = app(ProjectProgressService::class);

        $this->leader = User::factory()->create(['email_verified_at' => now()]);
        $this->staff1 = User::factory()->create(['email_verified_at' => now()]);
        $this->staff2 = User::factory()->create(['email_verified_at' => now()]);

        $this->project = Project::create([
            'title' => 'Annual Conference 2026',
            'status' => Project::STATUS_ACTIVE,
            'created_by' => $this->leader->id,
        ]);

        ProjectRoleAssignment::create([
            'project_id' => $this->project->id,
            'user_id' => $this->leader->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_LEADER,
            'committee_id' => null,
        ]);

        $this->committeeA = Committee::create([
            'project_id' => $this->project->id,
            'name' => 'Logistics Committee',
        ]);

        $this->committeeB = Committee::create([
            'project_id' => $this->project->id,
            'name' => 'Technical Committee',
        ]);

        ProjectRoleAssignment::create([
            'project_id' => $this->project->id,
            'user_id' => $this->staff1->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_STAFF,
            'committee_id' => $this->committeeA->id,
        ]);

        ProjectRoleAssignment::create([
            'project_id' => $this->project->id,
            'user_id' => $this->staff2->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_STAFF,
            'committee_id' => $this->committeeB->id,
        ]);
    }

    public function test_empty_event_and_committee_have_zero_progress(): void
    {
        $projectProgress = $this->progressService->calculateProjectProgress($this->project);
        $this->assertSame(0, $projectProgress['progress']);
        $this->assertSame(0, $projectProgress['total_activities']);
        $this->assertSame(0, $projectProgress['completed_activities']);

        $committeeProgress = $this->progressService->calculateCommitteeProgress($this->committeeA);
        $this->assertSame(0, $committeeProgress['progress']);
        $this->assertSame(0, $committeeProgress['total_activities']);
        $this->assertSame(0, $committeeProgress['completed_activities']);
    }

    public function test_tasks_do_not_directly_affect_event_or_committee_progress(): void
    {
        // Create an activity with status IN_PROGRESS
        $activity = Activity::create([
            'project_id' => $this->project->id,
            'committee_id' => $this->committeeA->id,
            'title' => 'Deliverable 1',
            'status' => Activity::STATUS_IN_PROGRESS,
            'created_by' => $this->staff1->id,
        ]);

        // Create 4 tasks, all marked COMPLETED (100% task progress)
        for ($i = 1; $i <= 4; $i++) {
            Task::create([
                'activity_id' => $activity->id,
                'title' => "Task {$i}",
                'status' => Task::STATUS_COMPLETED,
            ]);
        }

        // Deliverable task progress is 100%
        $actProgress = $this->progressService->calculateActivityProgress($activity);
        $this->assertSame(100, $actProgress['progress']);
        $this->assertSame(4, $actProgress['completed_tasks']);
        $this->assertSame(4, $actProgress['total_tasks']);
        $this->assertFalse($actProgress['is_completed']);

        // BUT Event Progress MUST still be 0% because 0 deliverables are Completed!
        $projectProgress = $this->progressService->calculateProjectProgress($this->project);
        $this->assertSame(0, $projectProgress['progress']);
        $this->assertSame(1, $projectProgress['total_activities']);
        $this->assertSame(0, $projectProgress['completed_activities']);

        // AND Committee Progress MUST still be 0%!
        $committeeProgress = $this->progressService->calculateCommitteeProgress($this->committeeA);
        $this->assertSame(0, $committeeProgress['progress']);
        $this->assertSame(1, $committeeProgress['total_activities']);
        $this->assertSame(0, $committeeProgress['completed_activities']);
    }

    public function test_marking_deliverable_completed_updates_event_and_committee_progress_immediately(): void
    {
        $delivA1 = Activity::create([
            'project_id' => $this->project->id,
            'committee_id' => $this->committeeA->id,
            'title' => 'Deliverable A1',
            'status' => Activity::STATUS_IN_PROGRESS,
            'created_by' => $this->staff1->id,
        ]);

        $delivA2 = Activity::create([
            'project_id' => $this->project->id,
            'committee_id' => $this->committeeA->id,
            'title' => 'Deliverable A2',
            'status' => Activity::STATUS_IN_PROGRESS,
            'created_by' => $this->staff1->id,
        ]);

        $delivB1 = Activity::create([
            'project_id' => $this->project->id,
            'committee_id' => $this->committeeB->id,
            'title' => 'Deliverable B1',
            'status' => Activity::STATUS_IN_PROGRESS,
            'created_by' => $this->staff2->id,
        ]);

        $delivB2 = Activity::create([
            'project_id' => $this->project->id,
            'committee_id' => $this->committeeB->id,
            'title' => 'Deliverable B2',
            'status' => Activity::STATUS_IN_PROGRESS,
            'created_by' => $this->staff2->id,
        ]);

        // Total: 4 deliverables across 2 committees. 0 completed.
        ProjectProgressService::clearProjectProgressCache($this->project->id);
        $this->assertSame(0, $this->progressService->calculateProjectProgress($this->project)['progress']);
        $this->assertSame(0, $this->progressService->calculateCommitteeProgress($this->committeeA)['progress']);

        // Mark delivA1 as Completed
        $delivA1->update(['status' => Activity::STATUS_COMPLETED]);
        ProjectProgressService::clearProjectProgressCache($this->project->id);

        // Committee A has 1 of 2 completed = 50%
        $this->assertSame(50, $this->progressService->calculateCommitteeProgress($this->committeeA)['progress']);

        // Committee B still has 0 of 2 completed = 0%
        $this->assertSame(0, $this->progressService->calculateCommitteeProgress($this->committeeB)['progress']);

        // Event has 1 of 4 completed = 25%
        $this->assertSame(25, $this->progressService->calculateProjectProgress($this->project)['progress']);

        // Mark delivB1 and delivB2 as Completed
        $delivB1->update(['status' => Activity::STATUS_COMPLETED]);
        $delivB2->update(['status' => Activity::STATUS_COMPLETED]);
        ProjectProgressService::clearProjectProgressCache($this->project->id);

        // Committee B has 2 of 2 completed = 100%
        $this->assertSame(100, $this->progressService->calculateCommitteeProgress($this->committeeB)['progress']);

        // Event has 3 of 4 completed = 75%
        $this->assertSame(75, $this->progressService->calculateProjectProgress($this->project)['progress']);

        // If delivA1 is returned / reopened, progress recalculates immediately
        $delivA1->update(['status' => Activity::STATUS_RETURNED]);
        ProjectProgressService::clearProjectProgressCache($this->project->id);

        // Committee A drops to 0 of 2 = 0%
        $this->assertSame(0, $this->progressService->calculateCommitteeProgress($this->committeeA)['progress']);

        // Event drops to 2 of 4 = 50%
        $this->assertSame(50, $this->progressService->calculateProjectProgress($this->project)['progress']);
    }

    public function test_deliverable_can_be_completed_with_incomplete_tasks(): void
    {
        $deliverable = Activity::create([
            'project_id' => $this->project->id,
            'committee_id' => $this->committeeA->id,
            'title' => 'Deliverable with Incomplete Tasks',
            'status' => Activity::STATUS_COMPLETED,
            'created_by' => $this->staff1->id,
        ]);

        // 3 tasks: only 1 completed (task progress = 33%)
        Task::create(['activity_id' => $deliverable->id, 'title' => 'T1', 'status' => Task::STATUS_COMPLETED]);
        Task::create(['activity_id' => $deliverable->id, 'title' => 'T2', 'status' => Task::STATUS_IN_PROGRESS]);
        Task::create(['activity_id' => $deliverable->id, 'title' => 'T3', 'status' => Task::STATUS_TO_DO]);

        $actProgress = $this->progressService->calculateActivityProgress($deliverable);
        $this->assertSame(33, $actProgress['progress']);
        $this->assertTrue($actProgress['is_completed']);

        // Despite task progress being 33%, the official deliverable status is Completed,
        // so Committee and Event progress count it as 1 completed deliverable!
        $this->assertSame(100, $this->progressService->calculateCommitteeProgress($this->committeeA)['progress']);
        $this->assertSame(100, $this->progressService->calculateProjectProgress($this->project)['progress']);
    }
}
