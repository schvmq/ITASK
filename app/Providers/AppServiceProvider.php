<?php

namespace App\Providers;

use App\Models\Activity;
use App\Models\Committee;
use App\Models\Project;
use App\Models\Task;
use App\Policies\ActivityPolicy;
use App\Policies\CommitteePolicy;
use App\Policies\ProjectPolicy;
use App\Policies\TaskPolicy;
use Illuminate\Support\Facades\Gate;
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
    }
}
