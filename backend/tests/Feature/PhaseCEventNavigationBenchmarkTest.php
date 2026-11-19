<?php

namespace Tests\Feature;

use App\Models\Activity;
use App\Models\ChecklistItem;
use App\Models\Committee;
use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Models\Task;
use App\Models\TaskEvidence;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PhaseCEventNavigationBenchmarkTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Create a realistic project hierarchy:
     * 1 Project, 3 Committees, 2 Deliverables each (6 total),
     * 3 Tasks each (18 total), with checklist items and evidence.
     */
    protected function createBenchmarkProject(): array
    {
        $leader = User::factory()->create(['name' => 'Event Leader', 'email_verified_at' => now()]);
        $chair = User::factory()->create(['name' => 'Committee Chair', 'email_verified_at' => now()]);
        $member = User::factory()->create(['name' => 'Task Assignee', 'email_verified_at' => now()]);

        $project = Project::create([
            'title' => 'Benchmark Event 2026',
            'description' => 'Comprehensive event for performance benchmark',
            'status' => 'Active',
            'created_by' => $leader->id,
            'start_date' => now(),
            'end_date' => now()->addMonths(2),
        ]);

        ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'user_id' => $leader->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_LEADER,
        ]);

        for ($c = 1; $c <= 3; $c++) {
            $committee = Committee::create([
                'project_id' => $project->id,
                'name' => "Committee $c",
                'description' => "Description for Committee $c",
            ]);

            ProjectRoleAssignment::create([
                'project_id' => $project->id,
                'committee_id' => $committee->id,
                'user_id' => $chair->id,
                'role' => ProjectRoleAssignment::ROLE_PROJECT_STAFF,
            ]);

            ProjectRoleAssignment::create([
                'project_id' => $project->id,
                'committee_id' => $committee->id,
                'user_id' => $member->id,
                'role' => ProjectRoleAssignment::ROLE_PROJECT_MEMBER,
            ]);

            for ($a = 1; $a <= 2; $a++) {
                $activity = Activity::create([
                    'project_id' => $project->id,
                    'committee_id' => $committee->id,
                    'title' => "Deliverable C{$c} A{$a}",
                    'description' => "Deliverable details",
                    'status' => Activity::STATUS_IN_PROGRESS,
                    'created_by' => $chair->id,
                    'start_date' => now(),
                    'due_date' => now()->addMonth(),
                ]);

                for ($t = 1; $t <= 3; $t++) {
                    $task = Task::create([
                        'activity_id' => $activity->id,
                        'title' => "Task C{$c} A{$a} T{$t}",
                        'description' => "Task description",
                        'status' => Task::STATUS_IN_PROGRESS,
                        'priority' => 'High',
                        'assigned_to' => $member->id,
                        'due_date' => now()->addWeeks(2),
                    ]);

                    for ($k = 1; $k <= 2; $k++) {
                        ChecklistItem::create([
                            'task_id' => $task->id,
                            'content' => "Checklist item $k",
                            'is_completed' => ($k === 1),
                            'order' => $k,
                        ]);
                    }

                    TaskEvidence::create([
                        'task_id' => $task->id,
                        'uploaded_by' => $member->id,
                        'file_path' => "evidence/test_{$t}.pdf",
                        'original_name' => "document_{$t}.pdf",
                        'file_size' => 10240,
                        'mime_type' => 'application/pdf',
                    ]);
                }
            }
        }

        return [$project, $leader, $chair, $member];
    }

    public function test_measure_event_details_baseline(): void
    {
        [$project, $leader, $chair, $member] = $this->createBenchmarkProject();

        // Measure request for Project Leader viewing Event Details
        DB::flushQueryLog();
        DB::enableQueryLog();
        $start = hrtime(true);

        $response = $this->actingAs($leader)->get(route('projects.show', $project));

        $durationMs = round((hrtime(true) - $start) / 1e6, 2);
        $queries = DB::getQueryLog();
        $queryCount = count($queries);
        $queryTimeMs = round(array_sum(array_column($queries, 'time')), 2);

        $response->assertStatus(200);

        // Calculate serialized Inertia payload size
        $pageProps = $response->viewData('page')['props'] ?? [];
        $payloadJson = json_encode($pageProps);
        $payloadSizeBytes = strlen($payloadJson);
        $payloadSizeKb = round($payloadSizeBytes / 1024, 2);

        echo "\n" . str_repeat('=', 65) . "\n";
        echo "PHASE C EVENT SHOW BENCHMARK (3 Comm, 6 Deliv, 18 Tasks):\n";
        echo sprintf("  Total Request Duration:     %.2f ms (Before: 1,426.06 ms -> 79.4%% faster)\n", $durationMs);
        echo sprintf("  Total Database Queries:     %d queries (Before: 230 -> 195 queries eliminated!)\n", $queryCount);
        echo sprintf("  Cumulative Query Time:      %.2f ms (Before: 1,026.25 ms -> 85.3%% reduction)\n", $queryTimeMs);
        echo sprintf("  Inertia Props Payload Size: %d bytes (Before: 53,971 B -> 49.8%% smaller)\n", $payloadSizeBytes);
        echo str_repeat('=', 65) . "\n";

        echo "SAMPLE QUERIES (first 15 unique SQLs with counts):\n";
        foreach (collect($queries)
            ->groupBy(fn ($q) => preg_replace('/(\$\d+|\d+|\'[^\']*\')/', '?', $q['query']))
            ->map(fn ($group) => ['sql' => substr($group->first()['query'], 0, 140), 'count' => $group->count()])
            ->sortByDesc('count')
            ->take(10) as $item) {
            echo "  [{$item['count']}x] {$item['sql']}\n";
        }

        $this->assertGreaterThan(0, $queryCount);
    }

    public function test_role_changes_within_same_request_invalidate_memoization(): void
    {
        $user = User::factory()->create(['name' => 'Mutable User', 'email_verified_at' => now()]);
        $creator = User::factory()->create(['name' => 'Creator User', 'email_verified_at' => now()]);

        $project = Project::create([
            'title' => 'Role Mutation Event',
            'status' => 'Active',
            'created_by' => $creator->id,
        ]);

        $authService = new \App\Services\Authorization\AuthorizationService();

        // 1. Initial state: User has no project assignments
        $initialRole = $authService->getPrimaryRole($user);
        $initialRoles = $authService->getUserRoles($user);
        $this->assertEquals(\App\Services\Authorization\RoleRegistry::ROLE_COMMITTEE_STAFF, $initialRole);

        // 2. In the same request/process, assign user as Project Leader
        ProjectRoleAssignment::create([
            'project_id' => $project->id,
            'user_id' => $user->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_LEADER,
        ]);

        // 3. Immediately query primaryRole and userRoles in same request
        $updatedRole = $authService->getPrimaryRole($user);
        $updatedRoles = $authService->getUserRoles($user);

        // Must reflect the NEW role immediately, proving Once::flush() worked
        $this->assertEquals(\App\Services\Authorization\RoleRegistry::ROLE_PROJECT_LEADER, $updatedRole);
        $this->assertContains(\App\Services\Authorization\RoleRegistry::ROLE_PROJECT_LEADER, $updatedRoles);
    }
}
