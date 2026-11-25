<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_skill_ratings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('skill_id')->constrained('skills')->cascadeOnDelete();
            $table->smallInteger('rating');
            $table->timestamps();

            $table->unique(['user_id', 'skill_id']);
            $table->index('skill_id');
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE user_skill_ratings ADD CONSTRAINT chk_user_rating_range CHECK (rating >= 0 AND rating <= 4)');
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE user_skill_ratings DROP CONSTRAINT IF EXISTS chk_user_rating_range');
        }

        Schema::dropIfExists('user_skill_ratings');
    }
};
