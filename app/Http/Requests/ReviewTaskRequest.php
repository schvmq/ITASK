<?php

namespace App\Http\Requests;

use App\Models\Activity;
use App\Models\Committee;
use App\Models\Project;
use App\Models\Task;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ReviewTaskRequest extends FormRequest
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

        // Strict hierarchy checks
        if (! $project || ! $committee || ! $activity || ! $task ||
            (int) $task->activity_id !== (int) $activity->id ||
            (int) $activity->committee_id !== (int) $committee->id ||
            (int) $committee->project_id !== (int) $project->id) {
            abort(404);
        }

        return $this->user()?->can('review', $task) ?? false;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'action' => ['sometimes', 'required', 'string', Rule::in(['approve', 'complete', 'return', 'return_for_revision'])],
            'review_feedback' => ['nullable', 'string', 'max:2000'],
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

            if ($task->status !== Task::STATUS_UNDER_REVIEW) {
                $validator->errors()->add('status', 'Task must be under review to be reviewed.');
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
            'action.required' => 'A review action is required.',
            'action.in' => 'The selected review action is invalid.',
            'review_feedback.max' => 'Review feedback cannot exceed 2000 characters.',
        ];
    }
}
