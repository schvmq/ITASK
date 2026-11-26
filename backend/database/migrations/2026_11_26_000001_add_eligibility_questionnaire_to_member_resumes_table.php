<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('member_resumes', function (Blueprint $table) {
            $table->string('original_name')->nullable()->change();
            $table->string('file_path')->nullable()->change();
            $table->string('mime_type')->nullable()->change();

            $table->json('strengths_assessment')->nullable()->after('eligibility_status');
            $table->json('preferred_task_categories')->nullable()->after('strengths_assessment');
            $table->string('leadership_readiness')->nullable()->after('preferred_task_categories');
            $table->string('availability_hours')->nullable()->after('leadership_readiness');
            $table->text('deliberation_notes')->nullable()->after('availability_hours');
            $table->timestamp('assessment_completed_at')->nullable()->after('deliberation_notes');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('member_resumes', function (Blueprint $table) {
            $table->dropColumn([
                'strengths_assessment',
                'preferred_task_categories',
                'leadership_readiness',
                'availability_hours',
                'deliberation_notes',
                'assessment_completed_at',
            ]);
        });

        // Only restore NOT NULL constraints when no questionnaire-only rows contain null CV columns.
        if (DB::table('member_resumes')
            ->whereNull('original_name')
            ->orWhereNull('file_path')
            ->orWhereNull('mime_type')
            ->doesntExist()
        ) {
            Schema::table('member_resumes', function (Blueprint $table) {
                $table->string('original_name')->nullable(false)->change();
                $table->string('file_path')->nullable(false)->change();
                $table->string('mime_type')->nullable(false)->change();
            });
        }
    }
};
