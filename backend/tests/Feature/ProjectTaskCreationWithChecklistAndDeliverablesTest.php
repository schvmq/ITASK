<?php

namespace Tests\Feature;

use App\Models\Activity;
use App\Models\ChecklistItem;
use App\Models\Committee;
use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ProjectTaskCreationWithChecklistAndDeliverablesTest extends TestCase
{
    use RefreshDatabase;

    protected function createVerifiedUser(array $attributes = []): User
    {
        $user = User::create(array_merge([
            'name'     => 'User ' . uniqid(),
            'email'    => 'user_' . uniqid() . '@carsu.edu.ph',
            'password' => 'SecurePass123!',
        ], $attributes));

        $user->forceFill(['email_verified_at' => now()])->save();

        return $user;
    }

    public function test_leader_can_create_task_directly_in_project_with_checklist_and_deliverables(): void
    {
        $leader = $this->createVerifiedUser(['name' => 'Leader User']);
        $member = $this->createVerifiedUser(['name' => 'Member User']);

        $project = Project::create([
            'title'       => 'Annual Tech Summit 2026',
            'description' => 'Main technology summit project.',
            'status'      => Project::STATUS_PLANNING,
            'created_by'  => $leader->id,
            'start_date'  => '2026-10-01',
            'end_date'    => '2026-12-31',
        ]);

        ProjectRoleAssignment::create([
            'project_id'   => $project->id,
            'user_id'      => $leader->id,
            'role'         => ProjectRoleAssignment::ROLE_PROJECT_LEADER,
            'committee_id' => null,
        ]);

        ProjectRoleAssignment::create([
            'project_id'   => $project->id,
            'user_id'      => $member->id,
            'role'         => ProjectRoleAssignment::ROLE_PROJECT_MEMBER,
            'committee_id' => null,
        ]);

        $response = $this->actingAs($leader)->post(route('projects.tasks.store', $project), [
            'title' => 'Prepare Sponsorship Prospectus',
            'description' => 'Create and finalize sponsorship packages for industry partners.',
            'due_date' => '2026-11-15',
            'priority' => 'High',
            'assigned_to' => $member->id,
            'requires_review' => true,
            'deliverable_guidelines' => 'Upload signed partner MOA and high-resolution brochure PDF.',
            'checklist' => [
                'Draft sponsorship tiers',
                'Design partner benefits table',
                'Review with finance head',
            ],
        ]);

        $response->assertRedirect(route('projects.show', ['project' => $project->id, 'tab' => 'tasks']));
        $response->assertSessionHas('status');

        // Verify task in database
        $this->assertDatabaseHas('tasks', [
            'title' => 'Prepare Sponsorship Prospectus',
            'assigned_to' => $member->id,
            'requires_review' => true,
            'priority' => 'High',
        ]);

        $task = Task::where('title', 'Prepare Sponsorship Prospectus')->firstOrFail();
        $this->assertStringContainsString('Expected Deliverables', $task->description);

        // Verify checklist items in database
        $this->assertDatabaseHas('checklist_items', [
            'task_id' => $task->id,
            'content' => 'Draft sponsorship tiers',
            'is_completed' => false,
            'order' => 0,
        ]);
        $this->assertDatabaseHas('checklist_items', [
            'task_id' => $task->id,
            'content' => 'Design partner benefits table',
            'is_completed' => false,
            'order' => 1,
        ]);
        $this->assertDatabaseHas('checklist_items', [
            'task_id' => $task->id,
            'content' => 'Review with finance head',
            'is_completed' => false,
            'order' => 2,
        ]);

        // Verify task appears on projects.show Inertia view
        $showResponse = $this->actingAs($leader)->get(route('projects.show', $project));
        $showResponse->assertStatus(200);
        $showResponse->assertInertia(fn (Assert $page) => $page
            ->component('Projects/Show')
            ->has('project.tasks', 1)
            ->where('project.tasks.0.id', (string) $task->id)
            ->where('project.tasks.0.title', 'Prepare Sponsorship Prospectus')
            ->where('project.tasks.0.requires_review', true)
            ->where('project.tasks.0.checklist_total', 3)
            ->where('project.tasks.0.checklist_completed', 0)
            ->has('project.tasks.0.checklist_items', 3)
        );
    }

    public function test_assigned_member_can_toggle_checklist_and_upload_deliverables(): void
    {
        Storage::fake('local');

        $leader = $this->createVerifiedUser(['name' => 'Leader User']);
        $member = $this->createVerifiedUser(['name' => 'Member User']);

        $project = Project::create([
            'title'       => 'Robotics Exhibition',
            'description' => 'Annual robotics showcase.',
            'status'      => Project::STATUS_PLANNING,
            'created_by'  => $leader->id,
        ]);

        ProjectRoleAssignment::create([
            'project_id'   => $project->id,
            'user_id'      => $leader->id,
            'role'         => ProjectRoleAssignment::ROLE_PROJECT_LEADER,
            'committee_id' => null,
        ]);

        $committee = $project->committees()->create([
            'name' => 'Technical Committee',
            'description' => 'Technical hardware & software operations',
        ]);

        ProjectRoleAssignment::create([
            'project_id'   => $project->id,
            'user_id'      => $member->id,
            'role'         => ProjectRoleAssignment::ROLE_PROJECT_MEMBER,
            'committee_id' => $committee->id,
        ]);

        $activity = $committee->activities()->create([
            'project_id' => $project->id,
            'created_by' => $leader->id,
            'title' => 'Hardware Assembly',
            'status' => 'To Do',
        ]);

        $task = $activity->tasks()->create([
            'title' => 'Assemble Sensor Array',
            'description' => 'Assemble and wire ultrasonic and LiDAR sensors.',
            'status' => Task::STATUS_TO_DO,
            'assigned_to' => $member->id,
            'requires_review' => true,
        ]);

        $checklistItem = $task->checklistItems()->create([
            'content' => 'Solder wire connections',
            'is_completed' => false,
            'order' => 0,
        ]);

        // 1. Member toggles checklist item
        $toggleResponse = $this->actingAs($member)->from(route('projects.show', ['project' => $project->id, 'tab' => 'tasks']))
            ->patch(route('projects.committees.activities.tasks.checklist.update', [
                'project' => $project->id,
                'committee' => $committee->id,
                'activity' => $activity->id,
                'task' => $task->id,
                'checklist_item' => $checklistItem->id,
            ]), [
                'is_completed' => true,
            ]);

        $toggleResponse->assertRedirect(route('projects.show', ['project' => $project->id, 'tab' => 'tasks']));
        $this->assertDatabaseHas('checklist_items', [
            'id' => $checklistItem->id,
            'is_completed' => true,
        ]);

        // 2. Member uploads deliverable MOV file
        $file = UploadedFile::fake()->create('sensor_wiring_test_report.pdf', 250, 'application/pdf');

        $uploadResponse = $this->actingAs($member)->from(route('projects.show', ['project' => $project->id, 'tab' => 'tasks']))
            ->post(route('projects.committees.activities.tasks.evidence.store', [
                'project' => $project->id,
                'committee' => $committee->id,
                'activity' => $activity->id,
                'task' => $task->id,
            ]), [
                'file' => $file,
                'remarks' => 'Completed all solder points according to schematics.',
            ]);

        $uploadResponse->assertRedirect(route('projects.show', ['project' => $project->id, 'tab' => 'tasks']));
        $this->assertDatabaseHas('task_evidences', [
            'task_id' => $task->id,
            'original_name' => 'sensor_wiring_test_report.pdf',
            'remarks' => 'Completed all solder points according to schematics.',
        ]);

        // 3. Member submits task for review
        $submitResponse = $this->actingAs($member)->from(route('projects.show', ['project' => $project->id, 'tab' => 'tasks']))
            ->post(route('projects.committees.activities.tasks.submit', [
                'project' => $project->id,
                'committee' => $committee->id,
                'activity' => $activity->id,
                'task' => $task->id,
            ]));

        $submitResponse->assertRedirect(route('projects.show', ['project' => $project->id, 'tab' => 'tasks']));
        $this->assertDatabaseHas('tasks', [
            'id' => $task->id,
            'status' => Task::STATUS_UNDER_REVIEW,
        ]);
    }
}
