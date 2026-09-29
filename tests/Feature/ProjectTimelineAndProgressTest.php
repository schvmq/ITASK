<?php

namespace Tests\Feature;

use App\Models\Activity;
use App\Models\Committee;
use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Models\Task;
use App\Models\User;
use App\Services\ProjectProgressService;
use App\Services\ProjectTimelineService;
use Carbon\Carbon;
use Database\Seeders\DevTestDataSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProjectTimelineAndProgressTest extends TestCase
{
    use RefreshDatabase;

    private ProjectProgressService $progressService;
    private ProjectTimelineService $timelineService;

    private User $leader;
    private User $staff1;
    private User $staff2;
    private User $member1;
    private User $outsider;

    private Project $project;
    private Committee $committee1;
    private Committee $committee2;

    protected function setUp(): void
    {
        parent::setUp();

        $this->progressService = app(ProjectProgressService::class);
        $this->timelineService = app(ProjectTimelineService::class);

        $this->leader = User::factory()->create([
            'name' => 'Project Leader User',
            'email' => 'leader@example.com',
            'email_verified_at' => now(),
        ]);

        $this->staff1 = User::factory()->create([
            'name' => 'Staff Committee 1',
            'email' => 'staff1@example.com',
            'email_verified_at' => now(),
        ]);

        $this->staff2 = User::factory()->create([
            'name' => 'Staff Committee 2',
            'email' => 'staff2@example.com',
            'email_verified_at' => now(),
        ]);

        $this->member1 = User::factory()->create([
            'name' => 'Member Committee 1',
            'email' => 'member1@example.com',
            'email_verified_at' => now(),
        ]);

        $this->outsider = User::factory()->create([
            'name' => 'Outsider User',
            'email' => 'outsider@example.com',
            'email_verified_at' => now(),
        ]);

        $this->project = Project::create([
            'title' => 'Alpha Roadmap Project',
            'description' => 'A structured project for timeline testing',
            'status' => Project::STATUS_ACTIVE,
            'start_date' => '2026-09-01',
            'end_date' => '2026-12-31',
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
            'name' => 'Committee 1',
            'description' => 'First functional committee',
        ]);

        ProjectRoleAssignment::create([
            'project_id' => $this->project->id,
            'user_id' => $this->staff1->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_STAFF,
            'committee_id' => $this->committee1->id,
        ]);

        ProjectRoleAssignment::create([
            'project_id' => $this->project->id,
            'user_id' => $this->member1->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_MEMBER,
            'committee_id' => $this->committee1->id,
        ]);

        $this->committee2 = Committee::create([
            'project_id' => $this->project->id,
            'name' => 'Committee 2',
            'description' => 'Second functional committee',
        ]);

        ProjectRoleAssignment::create([
            'project_id' => $this->project->id,
            'user_id' => $this->staff2->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_STAFF,
            'committee_id' => $this->committee2->id,
        ]);
    }

    // =========================================================================
    // 1. PROGRESS CALCULATION TESTS & EDGE CASES
    // =========================================================================

    public function test_task_level_progress(): void
    {
        $activity = Activity::create([
            'project_id' => $this->project->id,
            'committee_id' => $this->committee1->id,
            'title' => 'Logistics Setup',
            'status' => Activity::STATUS_IN_PROGRESS,
            'created_by' => $this->staff1->id,
        ]);

        $taskCompleted = Task::create([
            'activity_id' => $activity->id,
            'title' => 'Completed Task',
            'status' => Task::STATUS_COMPLETED,
            'assigned_to' => $this->member1->id,
        ]);

        $taskToDo = Task::create([
            'activity_id' => $activity->id,
            'title' => 'To Do Task',
            'status' => Task::STATUS_TO_DO,
            'assigned_to' => $this->member1->id,
        ]);

        $taskInProgress = Task::create([
            'activity_id' => $activity->id,
            'title' => 'In Progress Task',
            'status' => Task::STATUS_IN_PROGRESS,
            'assigned_to' => $this->member1->id,
        ]);

        $taskUnderReview = Task::create([
            'activity_id' => $activity->id,
            'title' => 'Under Review Task',
            'status' => Task::STATUS_UNDER_REVIEW,
            'assigned_to' => $this->member1->id,
        ]);

        $taskReturned = Task::create([
            'activity_id' => $activity->id,
            'title' => 'Returned Task',
            'status' => Task::STATUS_RETURNED,
            'assigned_to' => $this->member1->id,
        ]);

        $completedProgress = $this->progressService->calculateTaskProgress($taskCompleted);
        $this->assertSame(100, $completedProgress['progress']);
        $this->assertTrue($completedProgress['is_completed']);

        foreach ([$taskToDo, $taskInProgress, $taskUnderReview, $taskReturned] as $incompleteTask) {
            $calc = $this->progressService->calculateTaskProgress($incompleteTask);
            $this->assertSame(0, $calc['progress']);
            $this->assertFalse($calc['is_completed']);
        }
    }

    public function test_activity_progress_edge_cases(): void
    {
        // 1. Zero tasks — not completed
        $actZeroTasks = Activity::create([
            'project_id' => $this->project->id,
            'committee_id' => $this->committee1->id,
            'title' => 'Activity Without Tasks',
            'status' => Activity::STATUS_IN_PROGRESS,
            'created_by' => $this->staff1->id,
        ]);
        $calcZero = $this->progressService->calculateActivityProgress($actZeroTasks);
        $this->assertSame(0, $calcZero['progress']);
        $this->assertSame(0, $calcZero['total_tasks']);
        $this->assertSame(0, $calcZero['completed_tasks']);

        // 2. Zero tasks — marked completed
        $actZeroCompleted = Activity::create([
            'project_id' => $this->project->id,
            'committee_id' => $this->committee1->id,
            'title' => 'Activity Without Tasks Completed',
            'status' => Activity::STATUS_COMPLETED,
            'created_by' => $this->staff1->id,
        ]);
        $calcZeroCompleted = $this->progressService->calculateActivityProgress($actZeroCompleted);
        $this->assertSame(100, $calcZeroCompleted['progress']);

        // 3. Single task completed
        $actSingle = Activity::create([
            'project_id' => $this->project->id,
            'committee_id' => $this->committee1->id,
            'title' => 'Single Task Activity',
            'status' => Activity::STATUS_IN_PROGRESS,
            'created_by' => $this->staff1->id,
        ]);
        Task::create([
            'activity_id' => $actSingle->id,
            'title' => 'Solo Task Done',
            'status' => Task::STATUS_COMPLETED,
        ]);
        $calcSingle = $this->progressService->calculateActivityProgress($actSingle);
        $this->assertSame(100, $calcSingle['progress']);
        $this->assertSame(1, $calcSingle['total_tasks']);
        $this->assertSame(1, $calcSingle['completed_tasks']);

        // 4. Mixed tasks: 1 completed, 1 in progress, 1 under review, 1 returned
        $actMixed = Activity::create([
            'project_id' => $this->project->id,
            'committee_id' => $this->committee1->id,
            'title' => 'Mixed Tasks Activity',
            'status' => Activity::STATUS_IN_PROGRESS,
            'created_by' => $this->staff1->id,
        ]);
        Task::create(['activity_id' => $actMixed->id, 'title' => 'Task A', 'status' => Task::STATUS_COMPLETED]);
        Task::create(['activity_id' => $actMixed->id, 'title' => 'Task B', 'status' => Task::STATUS_IN_PROGRESS]);
        Task::create(['activity_id' => $actMixed->id, 'title' => 'Task C', 'status' => Task::STATUS_UNDER_REVIEW]);
        Task::create(['activity_id' => $actMixed->id, 'title' => 'Task D', 'status' => Task::STATUS_RETURNED]);

        $calcMixed = $this->progressService->calculateActivityProgress($actMixed);
        $this->assertSame(25, $calcMixed['progress']);
        $this->assertSame(4, $calcMixed['total_tasks']);
        $this->assertSame(1, $calcMixed['completed_tasks']);
    }

    public function test_committee_and_project_progress_aggregation(): void
    {
        // Empty committee with no activities
        $calcEmptyCommittee = $this->progressService->calculateCommitteeProgress($this->committee2);
        $this->assertSame(0, $calcEmptyCommittee['progress']);
        $this->assertSame(0, $calcEmptyCommittee['total_tasks']);
        $this->assertSame(0, $calcEmptyCommittee['total_activities']);

        // Committee 1 with two activities:
        // Act 1: 2 tasks, 2 completed (100%)
        $act1 = Activity::create([
            'project_id' => $this->project->id,
            'committee_id' => $this->committee1->id,
            'title' => 'Act 1',
            'status' => Activity::STATUS_COMPLETED,
            'created_by' => $this->staff1->id,
        ]);
        Task::create(['activity_id' => $act1->id, 'title' => 'T1', 'status' => Task::STATUS_COMPLETED]);
        Task::create(['activity_id' => $act1->id, 'title' => 'T2', 'status' => Task::STATUS_COMPLETED]);

        // Act 2: 2 tasks, 0 completed (0%)
        $act2 = Activity::create([
            'project_id' => $this->project->id,
            'committee_id' => $this->committee1->id,
            'title' => 'Act 2',
            'status' => Activity::STATUS_IN_PROGRESS,
            'created_by' => $this->staff1->id,
        ]);
        Task::create(['activity_id' => $act2->id, 'title' => 'T3', 'status' => Task::STATUS_IN_PROGRESS]);
        Task::create(['activity_id' => $act2->id, 'title' => 'T4', 'status' => Task::STATUS_TO_DO]);

        // Committee 1: 4 tasks total, 2 completed -> 50%
        $calcComm1 = $this->progressService->calculateCommitteeProgress($this->committee1);
        $this->assertSame(50, $calcComm1['progress']);
        $this->assertSame(4, $calcComm1['total_tasks']);
        $this->assertSame(2, $calcComm1['completed_tasks']);

        // Project total: 4 tasks total (from Comm 1) + 0 from Comm 2 = 50%
        $calcProject = $this->progressService->calculateProjectProgress($this->project);
        $this->assertSame(50, $calcProject['progress']);
        $this->assertSame(4, $calcProject['total_tasks']);
        $this->assertSame(2, $calcProject['completed_tasks']);
    }

    // =========================================================================
    // 2. DATES AND DURATION CALCULATION TESTS
    // =========================================================================

    public function test_duration_calculation_rules(): void
    {
        // 1. Same-day item: inclusive 1 day
        $durationSameDay = $this->timelineService->calculateDuration('2026-10-01', '2026-10-01');
        $this->assertSame(1, $durationSameDay);

        // 2. Multi-day item: inclusive 5 days (Oct 1, 2, 3, 4, 5)
        $durationMultiDay = $this->timelineService->calculateDuration('2026-10-01', '2026-10-05');
        $this->assertSame(5, $durationMultiDay);

        // 3. Missing start date: returns null safely
        $durationMissingStart = $this->timelineService->calculateDuration(null, '2026-10-05');
        $this->assertNull($durationMissingStart);

        // 4. Missing end date: returns null safely
        $durationMissingEnd = $this->timelineService->calculateDuration('2026-10-01', null);
        $this->assertNull($durationMissingEnd);

        // 5. Inverted dates (end before start): returns 0 safely, never negative
        $durationInverted = $this->timelineService->calculateDuration('2026-10-05', '2026-10-01');
        $this->assertSame(0, $durationInverted);
    }

    public function test_committee_derived_date_range_from_activities_and_tasks(): void
    {
        // Act 1: 2026-09-10 to 2026-09-20
        $act1 = Activity::create([
            'project_id' => $this->project->id,
            'committee_id' => $this->committee1->id,
            'title' => 'Early Activity',
            'status' => Activity::STATUS_IN_PROGRESS,
            'start_date' => '2026-09-10',
            'due_date' => '2026-09-20',
            'created_by' => $this->staff1->id,
        ]);

        // Act 2: 2026-09-15 to 2026-10-15
        $act2 = Activity::create([
            'project_id' => $this->project->id,
            'committee_id' => $this->committee1->id,
            'title' => 'Late Activity',
            'status' => Activity::STATUS_IN_PROGRESS,
            'start_date' => '2026-09-15',
            'due_date' => '2026-10-15',
            'created_by' => $this->staff1->id,
        ]);

        // Task with later due date: 2026-10-25
        Task::create([
            'activity_id' => $act2->id,
            'title' => 'Latest Deadline Task',
            'status' => Task::STATUS_TO_DO,
            'due_date' => '2026-10-25',
        ]);

        $timeline = $this->timelineService->getTimelineData($this->project, $this->leader);
        $committeeData = collect($timeline['committees'])->firstWhere('id', (string) $this->committee1->id);

        $this->assertNotNull($committeeData);
        $this->assertSame('2026-09-10', $committeeData['start_date_raw']);
        $this->assertSame('2026-10-25', $committeeData['end_date_raw']);
        // Sep 10 to Oct 25 inclusive: 21 days in Sep + 25 days in Oct = 46 days
        $this->assertSame(46, $committeeData['duration_days']);
    }

    // =========================================================================
    // 3. AUTHORITATIVE DATA HIERARCHY TESTS
    // =========================================================================

    public function test_timeline_hierarchy_and_parent_relationships(): void
    {
        $act = Activity::create([
            'project_id' => $this->project->id,
            'committee_id' => $this->committee1->id,
            'title' => 'Test Activity Node',
            'status' => Activity::STATUS_IN_PROGRESS,
            'start_date' => '2026-10-01',
            'due_date' => '2026-10-10',
            'created_by' => $this->staff1->id,
        ]);

        $task = Task::create([
            'activity_id' => $act->id,
            'title' => 'Test Task Node',
            'status' => Task::STATUS_TO_DO,
            'due_date' => '2026-10-08',
            'assigned_to' => $this->member1->id,
            'requires_review' => true,
        ]);

        $timeline = $this->timelineService->getTimelineData($this->project, $this->leader);

        // Project Node
        $this->assertSame('project', $timeline['type']);
        $this->assertNull($timeline['parent_id']);
        $this->assertSame((string) $this->project->id, $timeline['id']);

        // Committee Node
        $this->assertNotEmpty($timeline['committees']);
        $commNode = collect($timeline['committees'])->firstWhere('id', (string) $this->committee1->id);
        $this->assertSame('committee', $commNode['type']);
        $this->assertSame((string) $this->project->id, $commNode['parent_id']);
        $this->assertSame((string) $this->project->id, $commNode['project_id']);

        // Activity Node
        $this->assertNotEmpty($commNode['activities']);
        $actNode = $commNode['activities'][0];
        $this->assertSame('activity', $actNode['type']);
        $this->assertSame((string) $this->committee1->id, $actNode['parent_id']);
        $this->assertSame((string) $this->committee1->id, $actNode['committee_id']);
        $this->assertSame((string) $this->project->id, $actNode['project_id']);

        // Task Node
        $this->assertNotEmpty($actNode['tasks']);
        $taskNode = $actNode['tasks'][0];
        $this->assertSame('task', $taskNode['type']);
        $this->assertSame((string) $act->id, $taskNode['parent_id']);
        $this->assertSame((string) $act->id, $taskNode['activity_id']);
        $this->assertSame((string) $this->member1->id, (string) $taskNode['assigned_user']['id']);
        $this->assertTrue($taskNode['requires_review']);
    }

    // =========================================================================
    // 4. AUTHORIZATION AND PROJECT SCOPE TESTS
    // =========================================================================

    public function test_project_leader_accesses_all_committees_in_project(): void
    {
        $response = $this->actingAs($this->leader)->getJson("/projects/{$this->project->id}/timeline");

        $response->assertOk();
        $response->assertJsonPath('success', true);
        $response->assertJsonCount(2, 'data.committees');
    }

    public function test_project_staff_only_receives_assigned_committee_timeline(): void
    {
        // Staff 1 is assigned only to Committee 1, NOT Committee 2
        $response = $this->actingAs($this->staff1)->getJson("/projects/{$this->project->id}/timeline");

        $response->assertOk();
        $response->assertJsonPath('success', true);
        $response->assertJsonCount(1, 'data.committees');
        $response->assertJsonPath('data.committees.0.id', (string) $this->committee1->id);
    }

    public function test_project_member_only_receives_assigned_committee_timeline(): void
    {
        // Member 1 is assigned only to Committee 1
        $response = $this->actingAs($this->member1)->getJson("/projects/{$this->project->id}/timeline");

        $response->assertOk();
        $response->assertJsonPath('success', true);
        $response->assertJsonCount(1, 'data.committees');
        $response->assertJsonPath('data.committees.0.id', (string) $this->committee1->id);
    }

    public function test_outsider_cannot_access_project_timeline(): void
    {
        $response = $this->actingAs($this->outsider)->getJson("/projects/{$this->project->id}/timeline");
        $response->assertForbidden();
    }

    public function test_guest_is_redirected_to_login(): void
    {
        $response = $this->get("/projects/{$this->project->id}/timeline");
        $response->assertRedirect('/login');
    }

    public function test_cross_project_isolation(): void
    {
        // Create second project with its own committee and activity
        $otherProject = Project::create([
            'title' => 'Other Project',
            'status' => Project::STATUS_ACTIVE,
            'created_by' => $this->outsider->id,
        ]);

        $otherCommittee = Committee::create([
            'project_id' => $otherProject->id,
            'name' => 'Other Committee',
        ]);

        Activity::create([
            'project_id' => $otherProject->id,
            'committee_id' => $otherCommittee->id,
            'title' => 'Other Activity',
            'status' => Activity::STATUS_IN_PROGRESS,
            'created_by' => $this->outsider->id,
        ]);

        $timeline = $this->timelineService->getTimelineData($this->project, $this->leader);
        $committeeIds = collect($timeline['committees'])->pluck('id')->all();

        $this->assertNotContains((string) $otherCommittee->id, $committeeIds);
    }

    // =========================================================================
    // 5. DASHBOARD AND TIMELINE PROGRESS CONSISTENCY
    // =========================================================================

    public function test_dashboard_and_timeline_progress_match(): void
    {
        $act = Activity::create([
            'project_id' => $this->project->id,
            'committee_id' => $this->committee1->id,
            'title' => 'Shared Metric Activity',
            'status' => Activity::STATUS_IN_PROGRESS,
            'created_by' => $this->staff1->id,
        ]);

        Task::create(['activity_id' => $act->id, 'title' => 'T1 Done', 'status' => Task::STATUS_COMPLETED]);
        Task::create(['activity_id' => $act->id, 'title' => 'T2 In Prog', 'status' => Task::STATUS_IN_PROGRESS]);

        // Timeline progress
        $timeline = $this->timelineService->getTimelineData($this->project, $this->leader);
        $timelineProgress = $timeline['progress'];

        // Dashboard progress
        $dashResponse = $this->actingAs($this->leader)->get('/dashboard');
        $dashResponse->assertOk();

        // In Dashboard, projects array first item progressPercentage
        $projects = $dashResponse->original->getData()['page']['props']['projects'];
        $projectItem = collect($projects)->firstWhere('id', (string) $this->project->id);

        $this->assertNotNull($projectItem);
        $this->assertSame(50, $timelineProgress);
        $this->assertSame($timelineProgress, $projectItem['progressPercentage']);
    }

    // =========================================================================
    // 6. SEEDED DATASET VERIFICATION (5 DEV ACCOUNTS)
    // =========================================================================

    public function test_seeded_data_verification_across_all_five_accounts(): void
    {
        $this->seed(DevTestDataSeeder::class);

        $leader = User::where('email', 'leader.itask@carsu.edu.ph')->firstOrFail();
        $staff = User::where('email', 'staff.itask@carsu.edu.ph')->firstOrFail();
        $member01 = User::where('email', 'member01.itask@carsu.edu.ph')->firstOrFail();
        $member02 = User::where('email', 'member02.itask@carsu.edu.ph')->firstOrFail();
        $member03 = User::where('email', 'member03.itask@carsu.edu.ph')->firstOrFail();

        $seededProject = Project::where('title', 'ITASK Test Project')->firstOrFail();

        // 1. Leader access: full visibility
        $leaderTimeline = $this->timelineService->getTimelineData($seededProject, $leader);
        $this->assertSame('ITASK Test Project', $leaderTimeline['name']);
        $this->assertSame(1, count($leaderTimeline['committees']));

        $committee = $leaderTimeline['committees'][0];
        $this->assertSame('Test Committee', $committee['name']);
        $this->assertSame(3, count($committee['activities']));

        // Activity 1: 3 tasks, 1 completed -> 33%
        $act1 = $committee['activities'][0];
        $this->assertSame(3, $act1['total_tasks']);
        $this->assertSame(1, $act1['completed_tasks']);
        $this->assertSame(33, $act1['progress']);

        // Activity 2: 3 tasks, 0 completed -> 0%
        $act2 = $committee['activities'][1];
        $this->assertSame(3, $act2['total_tasks']);
        $this->assertSame(0, $act2['completed_tasks']);
        $this->assertSame(0, $act2['progress']);

        // Activity 3: 4 tasks, 1 completed -> 25%
        $act3 = $committee['activities'][2];
        $this->assertSame(4, $act3['total_tasks']);
        $this->assertSame(1, $act3['completed_tasks']);
        $this->assertSame(25, $act3['progress']);

        // Overall committee & project progress: 2 / 10 = 20%
        $this->assertSame(10, $committee['total_tasks']);
        $this->assertSame(2, $committee['completed_tasks']);
        $this->assertSame(20, $committee['progress']);

        $this->assertSame(10, $leaderTimeline['total_tasks']);
        $this->assertSame(2, $leaderTimeline['completed_tasks']);
        $this->assertSame(20, $leaderTimeline['progress']);

        // 2. Staff access
        $staffTimeline = $this->timelineService->getTimelineData($seededProject, $staff);
        $this->assertSame(20, $staffTimeline['progress']);
        $this->assertSame(1, count($staffTimeline['committees']));

        // 3. Members access
        foreach ([$member01, $member02, $member03] as $member) {
            $memberTimeline = $this->timelineService->getTimelineData($seededProject, $member);
            $this->assertSame(20, $memberTimeline['progress']);
            $this->assertSame(1, count($memberTimeline['committees']));
            $this->assertSame(3, count($memberTimeline['committees'][0]['activities']));
        }
    }
}
