<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Add priority to tasks if not present
        if (Schema::hasTable('tasks') && ! Schema::hasColumn('tasks', 'priority')) {
            Schema::table('tasks', function (Blueprint $table) {
                $table->string('priority', 20)->default('Medium')->after('status');
            });
        }

        // 2. Create task_assignees table for multi-assignee tracking
        if (! Schema::hasTable('task_assignees')) {
            Schema::create('task_assignees', function (Blueprint $table) {
                $table->id();
                $table->foreignId('task_id')->constrained('tasks')->cascadeOnDelete();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->timestamps();

                $table->unique(['task_id', 'user_id']);
            });
        }

        // 3. Add softDeletes and task_id to messages
        if (Schema::hasTable('messages')) {
            Schema::table('messages', function (Blueprint $table) {
                if (! Schema::hasColumn('messages', 'task_id')) {
                    $table->foreignId('task_id')->nullable()->after('conversation_id')->constrained('tasks')->nullOnDelete();
                }
                if (! Schema::hasColumn('messages', 'deleted_at')) {
                    $table->softDeletes();
                }
            });
        }

        // 4. Add last_read_message_id to conversation_participants
        if (Schema::hasTable('conversation_participants')) {
            Schema::table('conversation_participants', function (Blueprint $table) {
                if (! Schema::hasColumn('conversation_participants', 'last_read_message_id')) {
                    $table->foreignId('last_read_message_id')->nullable()->after('last_read_at')->constrained('messages')->nullOnDelete();
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('conversation_participants') && Schema::hasColumn('conversation_participants', 'last_read_message_id')) {
            Schema::table('conversation_participants', function (Blueprint $table) {
                $table->dropForeign(['last_read_message_id']);
                $table->dropColumn('last_read_message_id');
            });
        }

        if (Schema::hasTable('messages')) {
            Schema::table('messages', function (Blueprint $table) {
                if (Schema::hasColumn('messages', 'task_id')) {
                    $table->dropForeign(['task_id']);
                    $table->dropColumn('task_id');
                }
                if (Schema::hasColumn('messages', 'deleted_at')) {
                    $table->dropSoftDeletes();
                }
            });
        }

        Schema::dropIfExists('task_assignees');

        if (Schema::hasTable('tasks') && Schema::hasColumn('tasks', 'priority')) {
            Schema::table('tasks', function (Blueprint $table) {
                $table->dropColumn('priority');
            });
        }
    }
};
