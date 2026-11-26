<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('skill_onboarding_acknowledged_at')->nullable()->after('remember_token');
            $table->timestamp('skill_assessment_completed_at')->nullable()->after('skill_onboarding_acknowledged_at');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'skill_onboarding_acknowledged_at',
                'skill_assessment_completed_at',
            ]);
        });
    }
};
