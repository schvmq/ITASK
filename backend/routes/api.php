<?php

use App\Http\Controllers\Api\ApiActivityController;
use App\Http\Controllers\Api\ApiAdminController;
use App\Http\Controllers\Api\ApiAuthController;
use App\Http\Controllers\Api\ApiCommitteeController;
use App\Http\Controllers\Api\ApiProjectController;
use App\Http\Controllers\Api\ApiTaskWorkflowController;
use App\Http\Controllers\Api\ApiWorkspaceController;
use App\Http\Controllers\ChatController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\ProjectTimelineController;
use Illuminate\Support\Facades\Route;

Route::middleware(['web'])->group(function () {
    // Authentication & Profile Endpoints
    Route::post('/auth/login', [ApiAuthController::class, 'login'])->name('api.auth.login');
    Route::post('/auth/register', [ApiAuthController::class, 'register'])->name('api.auth.register');
    Route::post('/auth/logout', [ApiAuthController::class, 'logout'])->name('api.auth.logout');

    Route::middleware('auth')->group(function () {
        Route::get('/auth/me', [ApiAuthController::class, 'me'])->name('api.auth.me');
        Route::get('/me', [ApiAuthController::class, 'me'])->name('api.me');
        Route::post('/email/verification-notification', [ApiAuthController::class, 'resendVerification'])->name('api.verification.send');

        // Project & Personnel Endpoints
        Route::get('/projects', [ApiProjectController::class, 'index'])->name('api.projects.index');
        Route::post('/projects', [ApiProjectController::class, 'store'])->name('api.projects.store');
        Route::get('/projects/{project}', [ApiProjectController::class, 'show'])->name('api.projects.show');
        Route::match(['put', 'patch'], '/projects/{project}', [ApiProjectController::class, 'update'])->name('api.projects.update');
        Route::post('/projects/{project}/archive', [ApiProjectController::class, 'archive'])->name('api.projects.archive');
        Route::post('/projects/{project}/unarchive', [ApiProjectController::class, 'unarchive'])->name('api.projects.unarchive');
        Route::delete('/projects/{project}', [ApiProjectController::class, 'destroy'])->name('api.projects.destroy');
        Route::post('/projects/{project}/personnel', [ApiProjectController::class, 'storePersonnel'])->name('api.projects.personnel.store');
        Route::delete('/projects/{project}/personnel/{user}', [ApiProjectController::class, 'destroyPersonnel'])->name('api.projects.personnel.destroy');

        // Committee Endpoints
        Route::post('/projects/{project}/committees', [ApiCommitteeController::class, 'store'])->name('api.committees.store');
        Route::get('/projects/{project}/committees/{committee}', [ApiCommitteeController::class, 'show'])->name('api.committees.show');
        Route::match(['put', 'patch'], '/projects/{project}/committees/{committee}', [ApiCommitteeController::class, 'update'])->name('api.committees.update');
        Route::delete('/projects/{project}/committees/{committee}', [ApiCommitteeController::class, 'destroy'])->name('api.committees.destroy');
        Route::post('/projects/{project}/committees/{committee}/staff', [ApiCommitteeController::class, 'assignStaff'])->name('api.committees.staff.store');
        Route::post('/projects/{project}/committees/{committee}/members', [ApiCommitteeController::class, 'assignMember'])->name('api.committees.members.store');
        Route::delete('/projects/{project}/committees/{committee}/members/{user}', [ApiCommitteeController::class, 'removeMember'])->name('api.committees.members.destroy');

        // Activity Endpoints
        Route::post('/projects/{project}/committees/{committee}/activities', [ApiActivityController::class, 'store'])->name('api.activities.store');
        Route::get('/projects/{project}/committees/{committee}/activities/{activity}', [ApiActivityController::class, 'show'])->name('api.activities.show');
        Route::match(['put', 'patch'], '/projects/{project}/committees/{committee}/activities/{activity}', [ApiActivityController::class, 'update'])->name('api.activities.update');
        Route::delete('/projects/{project}/committees/{committee}/activities/{activity}', [ApiActivityController::class, 'destroy'])->name('api.activities.destroy');
        Route::post('/projects/{project}/committees/{committee}/activities/{activity}/submit', [ApiActivityController::class, 'submit'])->name('api.activities.submit');
        Route::post('/projects/{project}/committees/{committee}/activities/{activity}/review', [ApiActivityController::class, 'review'])->name('api.activities.review');

        // Task Endpoints
        Route::post('/projects/{project}/committees/{committee}/activities/{activity}/tasks', [ApiTaskWorkflowController::class, 'storeTask'])->name('api.tasks.store');
        Route::match(['put', 'patch'], '/projects/{project}/committees/{committee}/activities/{activity}/tasks/{task}', [ApiTaskWorkflowController::class, 'updateTask'])->name('api.tasks.update');
        Route::delete('/projects/{project}/committees/{committee}/activities/{activity}/tasks/{task}', [ApiTaskWorkflowController::class, 'deleteTask'])->name('api.tasks.destroy');
        Route::post('/projects/{project}/committees/{committee}/activities/{activity}/tasks/{task}/submit', [ApiTaskWorkflowController::class, 'submitTask'])->name('api.tasks.submit');
        Route::post('/projects/{project}/committees/{committee}/activities/{activity}/tasks/{task}/approve', [ApiTaskWorkflowController::class, 'approveTask'])->name('api.tasks.approve');
        Route::post('/projects/{project}/committees/{committee}/activities/{activity}/tasks/{task}/return', [ApiTaskWorkflowController::class, 'returnTask'])->name('api.tasks.return');
        Route::post('/projects/{project}/committees/{committee}/activities/{activity}/tasks/{task}/resubmit', [ApiTaskWorkflowController::class, 'resubmitTask'])->name('api.tasks.resubmit');

        // Checklist Endpoints
        Route::post('/projects/{project}/committees/{committee}/activities/{activity}/tasks/{task}/checklist', [ApiTaskWorkflowController::class, 'storeChecklist'])->name('api.tasks.checklist.store');
        Route::match(['put', 'patch'], '/projects/{project}/committees/{committee}/activities/{activity}/tasks/{task}/checklist/{checklist_item}', [ApiTaskWorkflowController::class, 'updateChecklist'])->name('api.tasks.checklist.update');
        Route::delete('/projects/{project}/committees/{committee}/activities/{activity}/tasks/{task}/checklist/{checklist_item}', [ApiTaskWorkflowController::class, 'deleteChecklist'])->name('api.tasks.checklist.destroy');

        // Evidence Endpoints
        Route::post('/projects/{project}/committees/{committee}/activities/{activity}/tasks/{task}/evidence', [ApiTaskWorkflowController::class, 'storeEvidence'])->name('api.tasks.evidence.store');
        Route::get('/projects/{project}/committees/{committee}/activities/{activity}/tasks/{task}/evidence/{evidence}/download', [ApiTaskWorkflowController::class, 'downloadEvidence'])->name('api.tasks.evidence.download');
        Route::delete('/projects/{project}/committees/{committee}/activities/{activity}/tasks/{task}/evidence/{evidence}', [ApiTaskWorkflowController::class, 'deleteEvidence'])->name('api.tasks.evidence.destroy');

        // Workspace Endpoints (Dashboard, My Tasks, Calendar, Timeline)
        Route::get('/dashboard', [ApiWorkspaceController::class, 'dashboard'])->name('api.workspace.dashboard');
        Route::get('/workspace/dashboard', [ApiWorkspaceController::class, 'dashboard']);
        Route::get('/my-tasks', [ApiWorkspaceController::class, 'myTasks'])->name('api.workspace.my-tasks');
        Route::get('/workspace/my-tasks', [ApiWorkspaceController::class, 'myTasks']);
        Route::get('/calendar', [ApiWorkspaceController::class, 'calendar'])->name('api.workspace.calendar');
        Route::get('/workspace/calendar', [ApiWorkspaceController::class, 'calendar']);
        Route::get('/timeline', [ApiWorkspaceController::class, 'timeline'])->name('api.workspace.timeline');
        Route::get('/workspace/timeline', [ApiWorkspaceController::class, 'timeline']);
        Route::get('/projects/{project}/timeline', [ProjectTimelineController::class, 'show'])->name('api.projects.timeline');

        // Notification Endpoints
        Route::get('/notifications', [NotificationController::class, 'index'])->name('api.notifications.index');
        Route::post('/notifications/{notification}/read', [NotificationController::class, 'markAsRead'])->name('api.notifications.read');
        Route::post('/notifications/mark-all-read', [NotificationController::class, 'markAllAsRead'])->name('api.notifications.mark-all-read');

        // Chat Endpoints
        Route::get('/chat/{projectId?}', [ChatController::class, 'index'])->name('api.chat.index');
        Route::post('/chat/{chat}/messages', [ChatController::class, 'store'])->name('api.chat.messages.store');
        Route::post('/chat/{chat}/messages/{message}/delete', [ChatController::class, 'destroyMessage'])->name('api.chat.messages.destroy');
        Route::post('/chat/{chat}/messages/{messageId}/restore', [ChatController::class, 'restoreMessage'])->name('api.chat.messages.restore');
        Route::post('/chat/{chat}/tasks', [ChatController::class, 'createTask'])->name('api.chat.tasks.store');
        Route::post('/chat/{chat}/read', [ChatController::class, 'markAsRead'])->name('api.chat.read');
        Route::post('/chat/{chat}/typing', [ChatController::class, 'typing'])->name('api.chat.typing');
        Route::post('/chat/{chat}/pin', [ChatController::class, 'togglePin'])->name('api.chat.pin');
        Route::post('/chat/{chat}/mute', [ChatController::class, 'toggleMute'])->name('api.chat.mute');
        Route::get('/chat/attachments/{message}', [ChatController::class, 'downloadAttachment'])->name('api.chat.attachments.download');

        // Administration Endpoints (Admin Only)
        Route::middleware('admin')->prefix('admin')->name('api.admin.')->group(function () {
            Route::get('/dashboard', [ApiAdminController::class, 'index'])->name('dashboard');
            Route::post('/users/{user}/verify', [ApiAdminController::class, 'verifyUser'])->name('users.verify');
            Route::post('/users/{user}/deny', [ApiAdminController::class, 'denyUser'])->name('users.deny');
            Route::post('/users/{user}/role', [ApiAdminController::class, 'updateRole'])->name('users.role');
            Route::post('/users/{user}/toggle-admin', [ApiAdminController::class, 'toggleAdmin'])->name('users.toggle-admin');
            Route::delete('/users/{user}', [ApiAdminController::class, 'destroy'])->name('users.destroy');
            Route::post('/projects/{project}/toggle-archive', [ApiAdminController::class, 'toggleProjectArchive'])->name('projects.toggle-archive');
            Route::post('/settings', [ApiAdminController::class, 'updateSettings'])->name('settings.update');
        });
    });
});
