<?php

namespace App\Http\Requests;

use App\Models\Activity;
use App\Models\Committee;
use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateTaskRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        $project = $this->route('project');
        if (! $project instanceof Project) {
            $project = Project::find($project);
        }

        $committee = $this->route('committee');
        if (! $committee instanceof Committee) {
            $committee = Committee::find($committee);
        }

        $activity = $this->route('activity');
        if (! $activity instanceof Activity) {
            $activity = Activity::find($activity);
        }

        $task = $this->route('task');
        if (! $task instanceof Task) {
            $task = Task::find($task);
        }

        if (! $project || ! $committee || ! $activity || ! $task ||
            (int) $task->activity_id !== (int) $activity->id ||
            (int) $activity->committee_id !== (int) $committee->id ||
            (int) $committee->project_id !== (int) $project->id) {
            abort(404);
        }

        $user = $this->user();
        if (! $user || ! $user->can('update', $task)) {
            return false;
        }

        $isLeader = $task->activity->committee->project->roleAssignments()
            ->where('user_id', $user->id)
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_LEADER)
            ->exists();

        $isStaff = $task->activity->committee->roleAssignments()
            ->where('user_id', $user->id)
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_STAFF)
            ->exists();

        // If not Staff/Leader, user is assigned member and forbidden from management fields
        if (! $isLeader && ! $isStaff) {
            if ($this->hasAny(['title', 'description', 'due_date', 'assigned_to', 'requires_review'])) {
                return false;
            }

            return $this->has('status');
        }

        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $task = $this->route('task');
        if (! $task instanceof Task) {
            $task = Task::find($task);
        }
        $projectId = $task instanceof Task ? $task->activity?->project_id : null;
        $user = $this->user();

        $isLeader = null;
        if ($task && $user) {
            $isLeader = $task->activity->committee->project->roleAssignments()
                ->where('user_id', $user->id)
                ->where('role', ProjectRoleAssignment::ROLE_PROJECT_LEADER)
                ->exists();
        }

        $isStaff = $task && $user && $task->activity->committee->roleAssignments()
            ->where('user_id', $user->id)
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_STAFF)
            ->exists();

        if (! $isLeader && ! $isStaff) {
            return [
                'status' => ['required', 'string', Rule::in(Task::STATUSES)],
            ];
        }

        return [
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'due_date' => ['nullable', 'date'],
            'status' => ['sometimes', 'required', 'string', Rule::in(Task::STATUSES)],
            'requires_review' => ['sometimes', 'boolean'],
            'assigned_to' => [
                'nullable',
                'integer',
                'exists:users,id',
                function ($attribute, $value, $fail) use ($projectId) {
                    if (! $value) {
                        return;
                    }

                    $user = User::find($value);
                    if (! $user || ! $user->hasVerifiedEmail()) {
                        $fail('The assigned user must have a verified institutional email address.');
                        return;
                    }

                    if ($projectId) {
                        $isProjectPersonnel = ProjectRoleAssignment::where('project_id', $projectId)
                            ->where('user_id', $value)
                            ->exists();

                        if (! $isProjectPersonnel) {
                            $fail('The assigned user must belong to this project.');
                        }
                    }
                },
            ],
        ];
    }

    /**
     * Configure the validator instance.
     */
    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $task = $this->route('task');
            if (! $task instanceof Task) {
                $task = Task::find($task);
            }

            if (! $task) {
                return;
            }

            $user = $this->user();
            if (! $user) {
                return;
            }

            $isLeader = $task->activity->committee->project->roleAssignments()
                ->where('user_id', $user->id)
                ->where('role', ProjectRoleAssignment::ROLE_PROJECT_LEADER)
                ->exists();

            $isStaff = $task->activity->committee->roleAssignments()
                ->where('user_id', $user->id)
                ->where('role', ProjectRoleAssignment::ROLE_PROJECT_STAFF)
                ->exists();

            $newStatus = $this->input('status');

            // Status transition rules for assigned Project Members
            if (! $isLeader && ! $isStaff && $newStatus) {
                // 1. Members cannot return tasks
                if ($newStatus === Task::STATUS_RETURNED) {
                    $validator->errors()->add('status', 'Project members cannot return tasks for revision.');
                    return;
                }

                // 2. Completed tasks cannot change status
                if ($task->status === Task::STATUS_COMPLETED && $newStatus !== Task::STATUS_COMPLETED) {
                    $validator->errors()->add('status', 'Completed tasks cannot be reopened or changed.');
                    return;
                }

                // 3. For review-required tasks:
                if ($task->requires_review) {
                    if ($newStatus === Task::STATUS_COMPLETED) {
                        $validator->errors()->add('status', 'This task requires review and cannot be marked completed directly.');
                        return;
                    }

                    if ($task->status === Task::STATUS_UNDER_REVIEW && $newStatus === Task::STATUS_COMPLETED) {
                        $validator->errors()->add('status', 'Project members cannot approve their own work.');
                        return;
                    }
                }
            }
        });
    }

    /**
     * Get custom messages for validator errors.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'title.required' => 'The task title is required.',
            'title.max' => 'The task title cannot exceed 255 characters.',
            'due_date.date' => 'The due date must be a valid date.',
            'status.in' => 'The selected task status is invalid.',
            'assigned_to.exists' => 'The selected user was not found.',
            'requires_review.boolean' => 'The requires review field must be true or false.',
        ];
    }
}
