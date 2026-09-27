<?php

namespace App\Http\Requests;

use App\Models\Activity;
use App\Models\Committee;
use App\Models\Project;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateActivityRequest extends FormRequest
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

        return $this->user()?->can('update', $activity) ?? false;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'due_date' => ['nullable', 'date'],
            'status' => ['required', 'string', Rule::in(Activity::STATUSES)],
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
            'title.required' => 'The activity title is required.',
            'title.max' => 'The activity title cannot exceed 255 characters.',
            'due_date.date' => 'The due date must be a valid date.',
            'status.required' => 'The activity status is required.',
            'status.in' => 'The selected activity status is invalid.',
        ];
    }
}
