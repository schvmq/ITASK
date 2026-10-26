<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ─── Step 1: Export Existing Direct Messages to JSON Archive ───────────
        try {
            $archiveDir = storage_path('app/archive');
            if (! File::isDirectory($archiveDir)) {
                File::makeDirectory($archiveDir, 0755, true, true);
            }

            if (Schema::hasTable('conversations') && Schema::hasTable('messages')) {
                $directConversations = DB::table('conversations')
                    ->where('type', 'direct')
                    ->get();

                $archivePayload = [];

                foreach ($directConversations as $conv) {
                    $participants = [];
                    if (Schema::hasTable('conversation_participants')) {
                        $participants = DB::table('conversation_participants')
                            ->where('conversation_id', $conv->id)
                            ->get()
                            ->toArray();
                    }

                    $convMessages = DB::table('messages')
                        ->where('conversation_id', $conv->id)
                        ->get()
                        ->toArray();

                    $archivePayload[] = [
                        'conversation' => (array) $conv,
                        'participants' => $participants,
                        'messages' => $convMessages,
                    ];
                }

                $jsonPath = $archiveDir . '/direct_messages_archive_20261003.json';
                File::put($jsonPath, json_encode($archivePayload, JSON_PRETTY_PRINT));
            }
        } catch (\Throwable $e) {
            report($e);
        }

        // ─── Step 2: Create legacy_direct_messages_archive Table ───────────────
        if (! Schema::hasTable('legacy_direct_messages_archive')) {
            Schema::create('legacy_direct_messages_archive', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('original_conversation_id')->nullable();
                $table->unsignedBigInteger('original_message_id')->nullable();
                $table->unsignedBigInteger('sender_id')->nullable();
                $table->text('body')->nullable();
                $table->string('attachment_name')->nullable();
                $table->string('attachment_path')->nullable();
                $table->string('attachment_type')->nullable();
                $table->unsignedBigInteger('attachment_size')->nullable();
                $table->timestamp('sent_at')->nullable();
                $table->timestamp('archived_at')->useCurrent();
            });

            // Populate legacy_direct_messages_archive from existing direct messages
            if (Schema::hasTable('conversations') && Schema::hasTable('messages')) {
                $directConvIds = DB::table('conversations')
                    ->where('type', 'direct')
                    ->pluck('id');

                if ($directConvIds->isNotEmpty()) {
                    $existingMsgs = DB::table('messages')
                        ->whereIn('conversation_id', $directConvIds)
                        ->get();

                    foreach ($existingMsgs as $m) {
                        DB::table('legacy_direct_messages_archive')->insert([
                            'original_conversation_id' => $m->conversation_id,
                            'original_message_id' => $m->id,
                            'sender_id' => $m->sender_id,
                            'body' => $m->body,
                            'attachment_name' => $m->attachment_name ?? null,
                            'attachment_path' => $m->attachment_path ?? null,
                            'attachment_type' => $m->attachment_type ?? null,
                            'attachment_size' => $m->attachment_size ?? null,
                            'sent_at' => $m->created_at,
                            'archived_at' => now(),
                        ]);
                    }
                }
            }
        }

        // ─── Step 3: Add deleted_at to projects for Soft Delete Retention ───────
        if (Schema::hasTable('projects') && ! Schema::hasColumn('projects', 'deleted_at')) {
            Schema::table('projects', function (Blueprint $table) {
                $table->softDeletes()->after('end_date');
            });
        }

        // ─── Step 4: Create chats Table (1 Project = 1 Group Chat) ─────────────
        if (! Schema::hasTable('chats')) {
            Schema::create('chats', function (Blueprint $table) {
                $table->id();
                $table->foreignId('project_id')
                    ->unique()
                    ->constrained('projects')
                    ->cascadeOnDelete();
                $table->timestamp('archived_at')->nullable();
                $table->softDeletes();
                $table->timestamps();

                $table->index('project_id');
            });
        }

        // ─── Step 5: Adapt messages Table for Project Group Chats ──────────────
        if (Schema::hasTable('messages')) {
            Schema::table('messages', function (Blueprint $table) {
                if (! Schema::hasColumn('messages', 'chat_id')) {
                    $table->foreignId('chat_id')
                        ->nullable()
                        ->after('id')
                        ->constrained('chats')
                        ->cascadeOnDelete();
                }
                if (! Schema::hasColumn('messages', 'type')) {
                    $table->string('type', 30)->default('text')->after('sender_id');
                }
                if (! Schema::hasColumn('messages', 'edited_at')) {
                    $table->timestamp('edited_at')->nullable()->after('updated_at');
                }
            });

            // Make sender_id nullable for system messages if currently NOT NULL
            try {
                DB::statement('ALTER TABLE messages ALTER COLUMN sender_id DROP NOT NULL;');
            } catch (\Throwable $e) {
                // If already nullable or dialect differences, ignore
            }
            try {
                DB::statement('ALTER TABLE messages ALTER COLUMN conversation_id DROP NOT NULL;');
            } catch (\Throwable $e) {
                // Ignore
            }
        } else {
            Schema::create('messages', function (Blueprint $table) {
                $table->id();
                $table->foreignId('chat_id')->constrained('chats')->cascadeOnDelete();
                $table->foreignId('sender_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('type', 30)->default('text'); // text, task, system, file
                $table->text('body')->nullable();
                $table->foreignId('task_id')->nullable()->constrained('tasks')->nullOnDelete();
                $table->string('attachment_path')->nullable();
                $table->string('attachment_name')->nullable();
                $table->string('attachment_type')->nullable();
                $table->unsignedBigInteger('attachment_size')->nullable();
                $table->timestamp('edited_at')->nullable();
                $table->softDeletes();
                $table->timestamps();

                $table->index(['chat_id', 'created_at']);
            });
        }

        // ─── Step 6: Create chat_read_states Table ─────────────────────────────
        if (! Schema::hasTable('chat_read_states')) {
            Schema::create('chat_read_states', function (Blueprint $table) {
                $table->id();
                $table->foreignId('chat_id')->constrained('chats')->cascadeOnDelete();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->foreignId('last_read_message_id')->nullable()->constrained('messages')->nullOnDelete();
                $table->timestamp('read_at')->nullable();
                $table->timestamps();

                $table->unique(['chat_id', 'user_id']);
                $table->index(['chat_id', 'last_read_message_id']);
            });
        }

        // ─── Step 7: Create chat_user_preferences Table (Pins & Mutes) ─────────
        if (! Schema::hasTable('chat_user_preferences')) {
            Schema::create('chat_user_preferences', function (Blueprint $table) {
                $table->id();
                $table->foreignId('chat_id')->constrained('chats')->cascadeOnDelete();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->boolean('is_pinned')->default(false);
                $table->boolean('is_muted')->default(false);
                $table->timestamps();

                $table->unique(['chat_id', 'user_id']);
            });
        }

        // ─── Step 8: Idempotent Backfill: Create 1 Chat per Existing Project ───
        if (Schema::hasTable('projects') && Schema::hasTable('chats')) {
            $projects = DB::table('projects')->get();

            foreach ($projects as $project) {
                $existingChat = DB::table('chats')->where('project_id', $project->id)->first();

                if (! $existingChat) {
                    $chatId = DB::table('chats')->insertGetId([
                        'project_id' => $project->id,
                        'archived_at' => $project->status === 'Archived' ? now() : null,
                        'deleted_at' => $project->deleted_at ?? null,
                        'created_at' => $project->created_at ?? now(),
                        'updated_at' => now(),
                    ]);

                    // Post system message: "Project chat created. Everyone in this project can message here."
                    DB::table('messages')->insert([
                        'chat_id' => $chatId,
                        'sender_id' => null,
                        'type' => 'system',
                        'body' => 'Project chat created. Everyone in this project can message here.',
                        'created_at' => $project->created_at ?? now(),
                        'updated_at' => now(),
                    ]);
                }
            }
        }

        // ─── Step 9: Clean up legacy tables safely ────────────────────────────
        // Direct messages are preserved in legacy_direct_messages_archive and the JSON export.
        // We drop conversation_participants and conversations if safe.
        if (Schema::hasTable('conversation_participants')) {
            Schema::dropIfExists('conversation_participants');
        }
        if (Schema::hasTable('conversations')) {
            // Drop foreign key from messages if present
            if (Schema::hasColumn('messages', 'conversation_id')) {
                try {
                    Schema::table('messages', function (Blueprint $table) {
                        $table->dropForeign(['conversation_id']);
                        $table->dropColumn('conversation_id');
                    });
                } catch (\Throwable $e) {
                    // Ignore if fk not present
                }
            }
            Schema::dropIfExists('conversations');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('chat_user_preferences');
        Schema::dropIfExists('chat_read_states');

        if (Schema::hasTable('messages') && Schema::hasColumn('messages', 'chat_id')) {
            Schema::table('messages', function (Blueprint $table) {
                $table->dropForeign(['chat_id']);
                $table->dropColumn(['chat_id', 'type', 'edited_at']);
            });
        }

        Schema::dropIfExists('chats');

        if (Schema::hasTable('projects') && Schema::hasColumn('projects', 'deleted_at')) {
            Schema::table('projects', function (Blueprint $table) {
                $table->dropSoftDeletes();
            });
        }

        Schema::dropIfExists('legacy_direct_messages_archive');
    }
};
