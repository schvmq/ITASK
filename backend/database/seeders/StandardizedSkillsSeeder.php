<?php

namespace Database\Seeders;

use App\Models\Skill;
use App\Models\SkillCategory;
use Illuminate\Database\Seeder;

class StandardizedSkillsSeeder extends Seeder
{
    public const CATEGORIES = [
        [
            'name' => 'Documentation and Reporting',
            'display_order' => 1,
        ],
        [
            'name' => 'Event Coordination',
            'display_order' => 2,
        ],
        [
            'name' => 'Presentation and Communication',
            'display_order' => 3,
        ],
        [
            'name' => 'Media and Technical',
            'display_order' => 4,
        ],
    ];

    public const SKILLS = [
        // Category A — Documentation and Reporting
        [
            'category' => 'Documentation and Reporting',
            'code' => 'criteria_and_evidence_review',
            'name' => 'Criteria and Evidence Review',
            'statement' => 'I can interpret requirements and determine whether supporting documents satisfy them.',
            'display_order' => 1,
        ],
        [
            'category' => 'Documentation and Reporting',
            'code' => 'supporting_document_compilation_and_organization',
            'name' => 'Supporting Document Compilation and Organization',
            'statement' => 'I can identify, collect, and organize required supporting documents.',
            'display_order' => 2,
        ],
        [
            'category' => 'Documentation and Reporting',
            'code' => 'report_writing',
            'name' => 'Report Writing',
            'statement' => 'I can prepare clear and organized reports describing activities, findings, progress, and accomplishments.',
            'display_order' => 3,
        ],
        [
            'category' => 'Documentation and Reporting',
            'code' => 'document_editing_and_formatting',
            'name' => 'Document Editing and Formatting',
            'statement' => 'I can review and improve documents for accuracy, readability, and consistent formatting.',
            'display_order' => 4,
        ],
        [
            'category' => 'Documentation and Reporting',
            'code' => 'data_tabulation_and_summary',
            'name' => 'Data Tabulation and Summary',
            'statement' => 'I can organize and summarize data using spreadsheet tables and charts.',
            'display_order' => 5,
        ],
        [
            'category' => 'Documentation and Reporting',
            'code' => 'official_correspondence',
            'name' => 'Official Correspondence',
            'statement' => 'I can prepare official letters, memoranda, and institutional correspondence.',
            'display_order' => 6,
        ],
        [
            'category' => 'Documentation and Reporting',
            'code' => 'meeting_minutes',
            'name' => 'Meeting Minutes',
            'statement' => 'I can record meeting discussions, decisions, and action items.',
            'display_order' => 7,
        ],

        // Category B — Event Coordination
        [
            'category' => 'Event Coordination',
            'code' => 'event_and_activity_planning',
            'name' => 'Event and Activity Planning',
            'statement' => 'I can plan institutional activities, including their programs, schedules, and requirements.',
            'display_order' => 8,
        ],
        [
            'category' => 'Event Coordination',
            'code' => 'logistics_arrangement',
            'name' => 'Logistics Arrangement',
            'statement' => 'I can arrange venues, equipment, and materials needed for activities.',
            'display_order' => 9,
        ],
        [
            'category' => 'Event Coordination',
            'code' => 'external_and_office_coordination',
            'name' => 'External and Office Coordination',
            'statement' => 'I can coordinate institutional responsibilities with offices, guests, and partner organizations.',
            'display_order' => 10,
        ],

        // Category C — Presentation and Communication
        [
            'category' => 'Presentation and Communication',
            'code' => 'presenting_and_responding_to_queries',
            'name' => 'Presenting and Responding to Queries',
            'statement' => 'I can present information clearly and respond to questions from audiences or evaluators.',
            'display_order' => 11,
        ],
        [
            'category' => 'Presentation and Communication',
            'code' => 'program_hosting',
            'name' => 'Program Hosting',
            'statement' => 'I can serve as a host or emcee during institutional programs.',
            'display_order' => 12,
        ],
        [
            'category' => 'Presentation and Communication',
            'code' => 'publicity_and_information_dissemination',
            'name' => 'Publicity and Information Dissemination',
            'statement' => 'I can prepare and disseminate announcements through appropriate communication channels.',
            'display_order' => 13,
        ],

        // Category D — Media and Technical
        [
            'category' => 'Media and Technical',
            'code' => 'graphic_design_and_layout',
            'name' => 'Graphic Design and Layout',
            'statement' => 'I can create posters, certificates, and other visual materials.',
            'display_order' => 14,
        ],
        [
            'category' => 'Media and Technical',
            'code' => 'event_photography',
            'name' => 'Event Photography',
            'statement' => 'I can capture clear and appropriate photographs for institutional event documentation.',
            'display_order' => 15,
        ],
        [
            'category' => 'Media and Technical',
            'code' => 'video_recording',
            'name' => 'Video Recording',
            'statement' => 'I can record videos of institutional activities or presentations.',
            'display_order' => 16,
        ],
        [
            'category' => 'Media and Technical',
            'code' => 'video_editing',
            'name' => 'Video Editing',
            'statement' => 'I can edit recorded footage into a finished video.',
            'display_order' => 17,
        ],
        [
            'category' => 'Media and Technical',
            'code' => 'event_technical_support',
            'name' => 'Event Technical Support',
            'statement' => 'I can operate common technical equipment and digital tools needed to support institutional events.',
            'display_order' => 18,
        ],
    ];

    /**
     * Run the database seeds idempotently.
     */
    public function run(): void
    {
        $categoriesByName = [];

        foreach (self::CATEGORIES as $catData) {
            $category = SkillCategory::updateOrCreate(
                ['name' => $catData['name']],
                ['display_order' => $catData['display_order']]
            );
            $categoriesByName[$catData['name']] = $category;
        }

        foreach (self::SKILLS as $skillData) {
            $category = $categoriesByName[$skillData['category']];

            Skill::updateOrCreate(
                ['code' => $skillData['code']],
                [
                    'category_id' => $category->id,
                    'name' => $skillData['name'],
                    'statement' => $skillData['statement'],
                    'display_order' => $skillData['display_order'],
                ]
            );
        }
    }
}
