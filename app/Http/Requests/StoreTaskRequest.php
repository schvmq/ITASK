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

class StoreTaskRequest extends FormRequest
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

        if (! $project || ! $committee || ! $activity ||
            (int) $activity->committee_id !== (int) $committee->id ||
            (int) $committee->project_id !== (int) $project->id) {
            abort(404);
        }

        return $this->user()?->can('create', [Task::class, $activity]) ?? false;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $activity = $this->route('activity');
        $projectId = $activity instanceof Activity ? $activity->project_id : null;

        return [
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'due_date' => ['nullable', 'date'],
            'status' => ['sometimes', 'string', Rule::in(Task::STATUSES)],
            'requires_review' => ['nullable', 'boolean'],
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
