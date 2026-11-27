<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('member_resumes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('original_name');
            $table->string('file_path');
            $table->unsignedBigInteger('file_size')->default(0);
            $table->string('mime_type');
            $table->longText('extracted_text')->nullable();
            $table->json('extracted_skills')->nullable();
            $table->json('certifications')->nullable();
            $table->text('experience_summary')->nullable();
            $table->string('eligibility_status')->default('Eligible');
            $table->json('raw_ai_analysis')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('member_resumes');
    }
};

