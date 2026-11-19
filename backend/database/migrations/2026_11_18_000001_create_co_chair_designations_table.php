<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('co_chair_designations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('committee_id')->nullable()->constrained('committees')->cascadeOnDelete();
            $table->foreignId('designated_by')->constrained('users')->cascadeOnDelete();
            $table->timestamps();

            // Unique constraint for committee-level designations:
            // One user can only be designated co-chair once per committee
            $table->unique(['project_id', 'committee_id', 'user_id'], 'co_chairs_project_committee_user_unique');
        });

        // Partial unique index for event-level designations:
        // One user can only be designated event-level co-chair once per project (where committee_id IS NULL)
        DB::statement('CREATE UNIQUE INDEX co_chairs_event_unique ON co_chair_designations (project_id, user_id) WHERE committee_id IS NULL');
    }

    public function down(): void
    {
        Schema::dropIfExists('co_chair_designations');
    }
};
