<?php

namespace App\Http\Requests;

use App\Models\Activity;
use App\Models\Committee;
use App\Models\Project;
use Illuminate\Foundation\Http\FormRequest;

class SubmitActivityRequest extends FormRequest
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

        // Strict hierarchy check
        if (! $project || ! $committee || ! $activity ||
            (int) $activity->committee_id !== (int) $committee->id ||
            (int) $committee->project_id !== (int) $project->id) {
            abort(404);
        }

        return $this->user()?->can('submit', $activity) ?? false;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'submission_notes' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * Configure the validator instance.
     */
    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $activity = $this->route('activity');
            if (! $activity instanceof Activity) {
                $activity = Activity::find($activity);
            }

            if (! $activity) {
                return;
            }

            if ($activity->status === Activity::STATUS_UNDER_REVIEW) {
                $validator->errors()->add('status', 'This activity is already under review and cannot be resubmitted.');
            }

            if ($activity->status === Activity::STATUS_COMPLETED) {
                $validator->errors()->add('status', 'Completed activities cannot be resubmitted.');
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
            'submission_notes.max' => 'Submission notes cannot exceed 2000 characters.',
        ];
    }
}
