<?php

namespace App\Console\Commands;

use App\Models\Chat;
use App\Models\Project;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class PurgeSoftDeletedProjectsCommand extends Command
{
    protected $signature = 'projects:purge-deleted';

    protected $description = 'Permanently purge soft-deleted projects and their chats/attachments after the retention period';

    public function handle(): int
    {
        $retentionDays = Chat::PROJECT_RETENTION_DAYS;
        $cutoff = now()->subDays($retentionDays);

        $this->info("Scanning for projects deleted on or before {$cutoff->toDateTimeString()} ({$retentionDays}-day retention)...");

        $expiredProjects = Project::onlyTrashed()
            ->where('deleted_at', '<=', $cutoff)
            ->get();

        if ($expiredProjects->isEmpty()) {
            $this->info('No expired projects to purge.');
            return Command::SUCCESS;
        }

        $purgedCount = 0;

        foreach ($expiredProjects as $project) {
            DB::transaction(function () use ($project, &$purgedCount) {
                $chat = Chat::withTrashed()->where('project_id', $project->id)->first();

                if ($chat) {
                    // Remove attachment files from disk
                    $attachmentPaths = $chat->messages()
                        ->withTrashed()
                        ->whereNotNull('attachment_path')
                        ->pluck('attachment_path');

                    foreach ($attachmentPaths as $path) {
                        if ($path && Storage::disk('local')->exists($path)) {
                            Storage::disk('local')->delete($path);
                        }
                    }

                    // Delete read states and preferences
                    DB::table('chat_read_states')->where('chat_id', $chat->id)->delete();
                    DB::table('chat_user_preferences')->where('chat_id', $chat->id)->delete();

                    // Force delete messages
                    $chat->messages()->withTrashed()->forceDelete();

                    // Force delete chat
                    $chat->forceDelete();
                }

                // Delete project approval documents from disk
                foreach ($project->approvalDocuments as $doc) {
                    if ($doc->file_path && Storage::disk('local')->exists($doc->file_path)) {
                        Storage::disk('local')->delete($doc->file_path);
                    }
                    $doc->delete();
                }

                // Delete project tasks and activities
                foreach ($project->activities as $activity) {
                    foreach ($activity->tasks as $task) {
                        DB::table('task_assignees')->where('task_id', $task->id)->delete();
                        $task->checklistItems()->delete();
                        $task->evidences()->delete();
                        $task->delete();
                    }
                    $activity->delete();
                }

                // Delete committees and role assignments
                $project->committees()->delete();
                $project->roleAssignments()->delete();

                // Force delete project
                $project->forceDelete();

                $purgedCount++;

                Log::info("Purged soft-deleted project ID: {$project->id}, Title: \"{$project->title}\" after {$project->deleted_at->diffInDays(now())} days.");
            });
        }

        $this->info("Successfully purged {$purgedCount} expired projects and their chats/attachments.");

        return Command::SUCCESS;
    }
}
