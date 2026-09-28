<?php

namespace App\Http\Requests;

use App\Models\Activity;
use App\Models\Committee;
use App\Models\Project;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ReviewActivityRequest extends FormRequest
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

        return $this->user()?->can('review', $activity) ?? false;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $action = $this->input('action');
        $isReturn = in_array($action, ['return', 'return_for_revision'], true);

        return [
            'action' => ['required', 'string', Rule::in(['complete', 'mark_completed', 'return', 'return_for_revision'])],
            'review_feedback' => [
                $isReturn ? 'required' : 'nullable',
                'string',
                'min:3',
                'max:2000',
            ],
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

            if ($activity->status !== Activity::STATUS_UNDER_REVIEW) {
                $validator->errors()->add('status', 'Activity must be under review to be reviewed.');
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
            'review_feedback.required' => 'Review feedback is required when returning an activity for revision.',
            'review_feedback.min' => 'Review feedback must be at least 3 characters.',
            'review_feedback.max' => 'Review feedback cannot exceed 2000 characters.',
        ];
    }
}
