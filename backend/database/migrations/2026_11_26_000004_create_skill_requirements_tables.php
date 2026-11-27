<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('deliverable_skill_requirements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('activity_id')->constrained('activities')->cascadeOnDelete();
            $table->foreignId('skill_id')->constrained('skills')->restrictOnDelete();
            $table->smallInteger('minimum_rating');
            $table->timestamps();

            $table->unique(['activity_id', 'skill_id']);
        });

        Schema::create('task_skill_requirements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('task_id')->constrained('tasks')->cascadeOnDelete();
            $table->foreignId('skill_id')->constrained('skills')->restrictOnDelete();
            $table->smallInteger('minimum_rating');
            $table->timestamps();

            $table->unique(['task_id', 'skill_id']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE deliverable_skill_requirements ADD CONSTRAINT chk_deliverable_req_min CHECK (minimum_rating >= 1 AND minimum_rating <= 4)');
            DB::statement('ALTER TABLE task_skill_requirements ADD CONSTRAINT chk_task_req_min CHECK (minimum_rating >= 1 AND minimum_rating <= 4)');
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE task_skill_requirements DROP CONSTRAINT IF EXISTS chk_task_req_min');
            DB::statement('ALTER TABLE deliverable_skill_requirements DROP CONSTRAINT IF EXISTS chk_deliverable_req_min');
        }

        Schema::dropIfExists('task_skill_requirements');
        Schema::dropIfExists('deliverable_skill_requirements');
    }
};
