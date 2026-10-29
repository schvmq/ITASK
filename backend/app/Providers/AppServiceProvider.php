<?php

namespace App\Providers;

use App\Models\Activity;
use App\Models\ChecklistItem;
use App\Models\Committee;
use App\Models\Project;
use App\Models\Task;
use App\Policies\ActivityPolicy;
use App\Policies\ChecklistItemPolicy;
use App\Policies\CommitteePolicy;
use App\Policies\ProjectPolicy;
use App\Policies\TaskPolicy;
use App\Models\Chat;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Gate::policy(Project::class, ProjectPolicy::class);
        Gate::policy(Committee::class, CommitteePolicy::class);
        Gate::policy(Activity::class, ActivityPolicy::class);
        Gate::policy(Task::class, TaskPolicy::class);
        Gate::policy(ChecklistItem::class, ChecklistItemPolicy::class);

        Route::bind('chat', function ($value) {
            return Chat::where('id', $value)->first()
                ?: Chat::where('project_id', $value)->first()
                ?: abort(404, 'Chat not found.');
        });

        Vite::createAssetPathsUsing(fn (string $path) => '/' . ltrim($path, '/'));
    }
}
