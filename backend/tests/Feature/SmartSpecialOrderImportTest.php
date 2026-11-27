<?php

namespace Tests\Feature;

use App\Models\Activity;
use App\Models\CoChairDesignation;
use App\Models\Committee;
use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Models\User;
use App\Services\SpecialOrder\SpecialOrderParserService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SmartSpecialOrderImportTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;
    protected User $overallChair;
    protected User $coChair1;
    protected User $member1;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create([
            'name' => 'Dean ITASK User',
            'email' => 'dean@carsu.edu.ph',
            'email_verified_at' => now(),
        ]);

        $this->overallChair = User::factory()->create([
            'name' => 'Dr. Jaymer M. Jayoma',
            'email' => 'jaymer.jayoma@carsu.edu.ph',
            'email_verified_at' => now(),
        ]);

        $this->coChair1 = User::factory()->create([
            'name' => 'Dr. Roland P. Abao',
            'email' => 'roland.abao@carsu.edu.ph',
            'email_verified_at' => now(),
        ]);

        $this->member1 = User::factory()->create([
            'name' => 'Juan Dela Cruz',
            'email' => 'juan.delacruz@carsu.edu.ph',
            'email_verified_at' => now(),
        ]);
    }

    public function test_user_can_access_smart_so_import_page(): void
    {
        $response = $this->actingAs($this->user)->get(route('projects.smart-import.create'));
        $response->assertStatus(200);
    }

    public function test_can_parse_sample_so_755_and_match_personnel(): void
    {
        $service = new SpecialOrderParserService();
        $data = $service->getSampleSO755Data();

        $this->assertEquals('S.O. No. 755, s. 2025', $data['so_number']);
        $this->assertEquals('Center of Excellence for ITE Education Application Task Force', $data['event_title']);
        $this->assertCount(8, $data['committees']);
        $this->assertCount(6, $data['event_co_chairs']);
        $this->assertCount(4, $data['suggested_deliverables']);

        // Overall Chair match check
        $this->assertTrue($data['overall_chair']['matched']);
        $this->assertEquals($this->overallChair->id, $data['overall_chair']['user_id']);

        // Check Criterion 1 chairperson match
        $c1 = $data['committees'][0];
        $this->assertEquals('Criterion 1: Innovation Culture', $c1['name']);
        $this->assertTrue($c1['chairperson']['matched']);
        $this->assertEquals($this->coChair1->id, $c1['chairperson']['user_id']);

        // Check member match
        $m1 = $c1['members'][0];
        $this->assertTrue($m1['matched']);
        $this->assertEquals($this->member1->id, $m1['user_id']);
    }

    public function test_can_parse_via_http_endpoint(): void
    {
        $response = $this->actingAs($this->user)->postJson(route('projects.smart-import.parse'), [
            'sample' => true,
        ]);

        $response->assertStatus(200);
        $response->assertJson([
            'success' => true,
        ]);
        $response->assertJsonPath('data.so_number', 'S.O. No. 755, s. 2025');
        $response->assertJsonCount(8, 'data.committees');
    }

    public function test_can_confirm_and_create_full_event_structure(): void
    {
        $payload = [
            'so_number' => 'S.O. No. 755, s. 2025',
            'event_title' => 'Center of Excellence for ITE Education Application Task Force',
            'submission_deadline' => '2025-10-31',
            'overall_chair_user_id' => $this->overallChair->id,
            'event_co_chair_user_ids' => [$this->coChair1->id],
            'committees' => [
                [
                    'name' => 'Criterion 1: Innovation Culture',
                    'description' => 'CHED COE Criterion 1',
                    'chairperson_user_id' => $this->coChair1->id,
                    'co_chair_user_ids' => [],
                    'member_user_ids' => [$this->member1->id],
                    'deliverables' => [
                        [
                            'title' => 'Completion of assigned review tasks',
                            'description' => 'Review milestone tasks',
                            'selected' => true,
                        ],
                        [
                            'title' => 'Review of supporting documents and evidence',
                            'description' => 'Evidence gathering',
                            'selected' => false,
                        ],
                    ],
                ],
                [
                    'name' => 'Criterion 2: Staff Development Tradition',
                    'description' => 'CHED COE Criterion 2',
                    'chairperson_user_id' => null,
                    'co_chair_user_ids' => [],
                    'member_user_ids' => [],
                    'deliverables' => [],
                ],
            ],
        ];

        $response = $this->actingAs($this->user)->post(route('projects.smart-import.confirm'), $payload);

        // Should redirect to projects.show
        $project = Project::where('title', 'Center of Excellence for ITE Education Application Task Force')->first();
        $this->assertNotNull($project);
        $response->assertRedirect(route('projects.show', $project));

        // 1. Check Overall Chair role assignment
        $overallChairAssignment = ProjectRoleAssignment::where('project_id', $project->id)
            ->where('user_id', $this->overallChair->id)
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_LEADER)
            ->first();
        $this->assertNotNull($overallChairAssignment);

        // 2. Check Event Co-Chair designation
        $eventCoChair = CoChairDesignation::where('project_id', $project->id)
            ->where('user_id', $this->coChair1->id)
            ->whereNull('committee_id')
            ->first();
        $this->assertNotNull($eventCoChair);

        // 3. Check Committees created
        $this->assertCount(2, $project->committees);
        $c1 = Committee::where('project_id', $project->id)->where('name', 'Criterion 1: Innovation Culture')->first();
        $this->assertNotNull($c1);

        // 4. Check Dual Role preservation: Dr. Roland Abao is BOTH Event Co-Chair AND Committee Chair!
        $committeeChairAssignment = ProjectRoleAssignment::where('project_id', $project->id)
            ->where('committee_id', $c1->id)
            ->where('user_id', $this->coChair1->id)
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_STAFF)
            ->first();
        $this->assertNotNull($committeeChairAssignment);

        // 5. Check Committee Member assignment
        $memberAssignment = ProjectRoleAssignment::where('project_id', $project->id)
            ->where('committee_id', $c1->id)
            ->where('user_id', $this->member1->id)
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_MEMBER)
            ->first();
        $this->assertNotNull($memberAssignment);

        // 6. Check Deliverable instantiated as Activity
        $activity = Activity::where('project_id', $project->id)
            ->where('committee_id', $c1->id)
            ->where('title', 'Completion of assigned review tasks')
            ->first();
        $this->assertNotNull($activity);
        $this->assertEquals(Activity::STATUS_TODO, $activity->status);

        // The unselected deliverable should NOT have an Activity record
        $unselectedActivity = Activity::where('project_id', $project->id)
            ->where('committee_id', $c1->id)
            ->where('title', 'Review of supporting documents and evidence')
            ->first();
        $this->assertNull($unselectedActivity);
    }
}

