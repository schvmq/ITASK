<?php

namespace Database\Seeders;

use App\Models\Activity;
use App\Models\ChecklistItem;
use App\Models\Committee;
use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Models\Task;
use App\Models\TaskEvidence;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;

class DevTestDataSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // ---------------------------------------------------------------------
        // 1. TEST ACCOUNTS
        // ---------------------------------------------------------------------
        $leader = User::updateOrCreate(
            ['email' => 'leader.itask@carsu.edu.ph'],
            [
                'name' => 'ITASK Test Leader',
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
            ]
        );

        $staff = User::updateOrCreate(
            ['email' => 'staff.itask@carsu.edu.ph'],
            [
                'name' => 'ITASK Test Staff',
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
            ]
        );

        $member1 = User::updateOrCreate(
            ['email' => 'member01.itask@carsu.edu.ph'],
            [
                'name' => 'ITASK Test Member 01',
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
            ]
        );

        $member2 = User::updateOrCreate(
            ['email' => 'member02.itask@carsu.edu.ph'],
            [
                'name' => 'ITASK Test Member 02',
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
            ]
        );

        $member3 = User::updateOrCreate(
            ['email' => 'member03.itask@carsu.edu.ph'],
            [
                'name' => 'ITASK Test Member 03',
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
            ]
        );

        // ---------------------------------------------------------------------
        // 2. TEST PROJECT
        // ---------------------------------------------------------------------
        $project = Project::updateOrCreate(
            ['title' => 'ITASK Test Project'],
            [
                'description' => 'Development and testing project for ITASK capstone workflow verification.',
                'status' => Project::STATUS_ACTIVE,
                'start_date' => '2026-09-01',
                'end_date' => '2026-12-31',
                'created_by' => $leader->id,
            ]
        );

        // ---------------------------------------------------------------------
        // 3. TEST COMMITTEE
        // ---------------------------------------------------------------------
        $committee = Committee::updateOrCreate(
            [
                'project_id' => $project->id,
                'name' => 'Test Committee',
            ],
            [
                'description' => 'Development and testing committee for capstone workflows.',
            ]
        );

        // ---------------------------------------------------------------------
        // 4. PROJECT ROLE ASSIGNMENTS
        // ---------------------------------------------------------------------
        ProjectRoleAssignment::updateOrCreate(
            [
                'project_id' => $project->id,
                'user_id' => $leader->id,
            ],
            [
                'role' => ProjectRoleAssignment::ROLE_PROJECT_LEADER,
                'committee_id' => null,
            ]
        );

        ProjectRoleAssignment::updateOrCreate(
            [
                'project_id' => $project->id,
                'user_id' => $staff->id,
            ],
            [
                'role' => ProjectRoleAssignment::ROLE_PROJECT_STAFF,
                'committee_id' => $committee->id,
            ]
        );

        ProjectRoleAssignment::updateOrCreate(
            [
                'project_id' => $project->id,
                'user_id' => $member1->id,
            ],
            [
                'role' => ProjectRoleAssignment::ROLE_PROJECT_MEMBER,
                'committee_id' => $committee->id,
            ]
        );

        ProjectRoleAssignment::updateOrCreate(
            [
                'project_id' => $project->id,
                'user_id' => $member2->id,
            ],
            [
                'role' => ProjectRoleAssignment::ROLE_PROJECT_MEMBER,
                'committee_id' => $committee->id,
            ]
        );

        ProjectRoleAssignment::updateOrCreate(
            [
                'project_id' => $project->id,
                'user_id' => $member3->id,
            ],
            [
                'role' => ProjectRoleAssignment::ROLE_PROJECT_MEMBER,
                'committee_id' => $committee->id,
            ]
        );

        // ---------------------------------------------------------------------
        // 5. TEST ACTIVITIES
        // ---------------------------------------------------------------------
        $activity1 = Activity::updateOrCreate(
            [
                'committee_id' => $committee->id,
                'title' => 'Normal Activity — Event Logistics',
            ],
            [
                'project_id' => $project->id,
                'created_by' => $staff->id,
                'description' => 'Logistical coordination, audio/visual equipment check, and venue setup.',
                'status' => Activity::STATUS_IN_PROGRESS,
                'start_date' => '2026-09-15',
                'due_date' => '2026-10-15',
            ]
        );

        $activity2 = Activity::updateOrCreate(
            [
                'committee_id' => $committee->id,
                'title' => 'Staff Review Activity — Program Flow',
            ],
            [
                'project_id' => $project->id,
                'created_by' => $staff->id,
                'description' => 'Program scripting, stage cueing, and guest speaker verification requiring staff review.',
                'status' => Activity::STATUS_IN_PROGRESS,
                'start_date' => '2026-09-20',
                'due_date' => '2026-10-20',
            ]
        );

        $activity3 = Activity::updateOrCreate(
            [
                'committee_id' => $committee->id,
                'title' => 'Multiple Tasks Activity — Documentation & Evaluation',
            ],
            [
                'project_id' => $project->id,
                'created_by' => $staff->id,
                'description' => 'Documentation, attendee feedback evaluation, and consolidated reporting across multiple members.',
                'status' => Activity::STATUS_IN_PROGRESS,
                'start_date' => '2026-09-25',
                'due_date' => '2026-10-30',
            ]
        );

        // ---------------------------------------------------------------------
        // 6. TEST TASKS
        // ---------------------------------------------------------------------
        // Activity 1 Tasks
        $task11 = Task::updateOrCreate(
            [
                'activity_id' => $activity1->id,
                'title' => 'Inspect Venue and Audio Setup',
            ],
            [
                'assigned_to' => $member1->id,
                'description' => 'Verify audio systems, microphones, and seating arrangements at the main auditorium.',
                'status' => Task::STATUS_IN_PROGRESS,
                'requires_review' => false,
                'due_date' => '2026-10-05',
            ]
        );

        $task12 = Task::updateOrCreate(
            [
                'activity_id' => $activity1->id,
                'title' => 'Order Technical Cables & Adapters',
            ],
            [
                'assigned_to' => $member2->id,
                'description' => 'Procure backup HDMI, Type-C, and XLR audio patch cables for presenter podium.',
                'status' => Task::STATUS_COMPLETED,
                'requires_review' => false,
                'due_date' => '2026-09-30',
            ]
        );

        $task13 = Task::updateOrCreate(
            [
                'activity_id' => $activity1->id,
                'title' => 'Confirm Wi-Fi Access Points',
            ],
            [
                'assigned_to' => $member3->id,
                'description' => 'Coordinate with ICT department for dedicated SSID and credentials for event attendees.',
                'status' => Task::STATUS_TO_DO,
                'requires_review' => false,
                'due_date' => '2026-10-10',
            ]
        );

        // Activity 2 Tasks
        $task21 = Task::updateOrCreate(
            [
                'activity_id' => $activity2->id,
                'title' => 'Draft Master Program & Script',
            ],
            [
                'assigned_to' => $member1->id,
                'description' => 'Prepare the official minute-by-minute program flow, emcee cue script, and protocol order.',
                'status' => Task::STATUS_UNDER_REVIEW,
                'requires_review' => true,
                'due_date' => '2026-10-10',
            ]
        );

        $task22 = Task::updateOrCreate(
            [
                'activity_id' => $activity2->id,
                'title' => 'Stage Cue Sheet & Timing Plan',
            ],
            [
                'assigned_to' => $member2->id,
                'description' => 'Please revise the timing sequence for the opening segment and resubmit the cue sheet.',
                'status' => Task::STATUS_RETURNED,
                'requires_review' => true,
                'due_date' => '2026-10-12',
            ]
        );

        $task23 = Task::updateOrCreate(
            [
                'activity_id' => $activity2->id,
                'title' => 'Speaker Invitation Confirmations',
            ],
            [
                'assigned_to' => $member3->id,
                'description' => 'Follow up on formal invitation acceptance and brief keynote speakers on time limits.',
                'status' => Task::STATUS_IN_PROGRESS,
                'requires_review' => true,
                'due_date' => '2026-10-18',
            ]
        );

        // Activity 3 Tasks
        $task31 = Task::updateOrCreate(
            [
                'activity_id' => $activity3->id,
                'title' => 'Member 01 Evaluation Rubric Setup',
            ],
            [
                'assigned_to' => $member1->id,
                'description' => 'Construct Google Form survey and quantitative assessment rubric for participants.',
                'status' => Task::STATUS_IN_PROGRESS,
                'requires_review' => false,
                'due_date' => '2026-10-15',
            ]
        );

        $task32 = Task::updateOrCreate(
            [
                'activity_id' => $activity3->id,
                'title' => 'Member 02 Registration Summary',
            ],
            [
                'assigned_to' => $member2->id,
                'description' => 'Collate online registration submissions, cross-check student attendance, and prepare summary.',
                'status' => Task::STATUS_IN_PROGRESS,
                'requires_review' => true,
                'due_date' => '2026-10-20',
            ]
        );

        $task33 = Task::updateOrCreate(
            [
                'activity_id' => $activity3->id,
                'title' => 'Member 03 Photo & Video Archiving',
            ],
            [
                'assigned_to' => $member3->id,
                'description' => 'Organize and label raw event coverage photos and video recordings into cloud drive folders.',
                'status' => Task::STATUS_TO_DO,
                'requires_review' => false,
                'due_date' => '2026-10-25',
            ]
        );

        $task34 = Task::updateOrCreate(
            [
                'activity_id' => $activity3->id,
                'title' => 'Final Consolidated Activity Report',
            ],
            [
                'assigned_to' => $member1->id,
                'description' => 'Consolidate committee findings, attendance numbers, and budget receipts into final activity dossier.',
                'status' => Task::STATUS_COMPLETED,
                'requires_review' => false,
                'due_date' => '2026-10-28',
            ]
        );

        // ---------------------------------------------------------------------
        // 7. CHECKLIST DATA
        // ---------------------------------------------------------------------
        ChecklistItem::updateOrCreate(
            [
                'task_id' => $task11->id,
                'content' => 'Check sound system',
            ],
            [
                'is_completed' => true,
                'order' => 0,
            ]
        );

        ChecklistItem::updateOrCreate(
            [
                'task_id' => $task11->id,
                'content' => 'Position projector screens',
            ],
            [
                'is_completed' => false,
                'order' => 1,
            ]
        );

        ChecklistItem::updateOrCreate(
            [
                'task_id' => $task11->id,
                'content' => 'Arrange presenter chairs',
            ],
            [
                'is_completed' => false,
                'order' => 2,
            ]
        );

        // ---------------------------------------------------------------------
        // 8. SAMPLE EVIDENCE FILES & RECORDS
        // ---------------------------------------------------------------------
        $evidenceDefinitions = [
            [
                'task' => $task21,
                'uploader' => $member1,
                'original_name' => 'program_flow_draft_v1.pdf',
                'file_name' => 'dev_program_flow_draft_v1.pdf',
                'remarks' => 'Draft master program flow submitted for staff review.',
                'title_in_pdf' => 'Program Flow Draft v1 - Master Schedule',
            ],
            [
                'task' => $task22,
                'uploader' => $member2,
                'original_name' => 'cue_sheet_initial.pdf',
                'file_name' => 'dev_cue_sheet_initial.pdf',
                'remarks' => 'Initial stage cue sheet returned for timing revision.',
                'title_in_pdf' => 'Stage Cue Sheet & Timing Plan v0.9',
            ],
            [
                'task' => $task23,
                'uploader' => $member3,
                'original_name' => 'speaker_acknowledgments.pdf',
                'file_name' => 'dev_speaker_acknowledgments.pdf',
                'remarks' => 'Signed speaker acknowledgment receipts and confirmations.',
                'title_in_pdf' => 'Keynote Speaker Confirmations & Bios',
            ],
            [
                'task' => $task34,
                'uploader' => $member1,
                'original_name' => 'preliminary_summary.pdf',
                'file_name' => 'dev_preliminary_summary.pdf',
                'remarks' => 'Preliminary consolidated activity evaluation and summary.',
                'title_in_pdf' => 'Preliminary Documentation & Evaluation Summary',
            ],
        ];

        foreach ($evidenceDefinitions as $evDef) {
            $filePath = 'task_evidences/' . $evDef['file_name'];
            $pdfContent = $this->generateValidSamplePdf($evDef['title_in_pdf']);

            // Ensure physical file exists in storage/app/task_evidences/
            if (! Storage::disk('local')->exists($filePath)) {
                Storage::disk('local')->put($filePath, $pdfContent);
            }

            TaskEvidence::updateOrCreate(
                [
                    'task_id' => $evDef['task']->id,
                    'original_name' => $evDef['original_name'],
                ],
                [
                    'uploaded_by' => $evDef['uploader']->id,
                    'file_path' => $filePath,
                    'file_size' => strlen($pdfContent),
                    'mime_type' => 'application/pdf',
                    'remarks' => $evDef['remarks'],
                ]
            );
        }
    }

    /**
     * Generate a minimal, valid PDF 1.4 document stream.
     */
    private function generateValidSamplePdf(string $title): string
    {
        $safeTitle = preg_replace('/[^\w\s\-\.\,\:\#]/', '', $title);
        $streamContent = "BT /F1 14 Tf 50 720 Td (ITASK - " . $safeTitle . ") Tj ET\n"
            . "BT /F1 10 Tf 50 690 Td (Generated for local development and manual verification testing.) Tj ET\n"
            . "BT /F1 10 Tf 50 670 Td (Date: 2026-09-29 | Caraga State University - CCIS) Tj ET";
        $streamLength = strlen($streamContent);

        return "%PDF-1.4\n"
            . "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n"
            . "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n"
            . "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n"
            . "4 0 obj << /Length " . $streamLength . " >> stream\n"
            . $streamContent . "\n"
            . "endstream endobj\n"
            . "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n"
            . "xref\n"
            . "0 6\n"
            . "0000000000 65535 f \n"
            . "0000000009 00000 n \n"
            . "0000000058 00000 n \n"
            . "0000000115 00000 n \n"
            . "0000000244 00000 n \n"
            . "0000000350 00000 n \n"
            . "trailer << /Size 6 /Root 1 0 R >>\n"
            . "startxref\n"
            . "429\n"
            . "%%EOF\n";
    }
}
