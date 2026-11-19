<?php

namespace App\Http\Requests;

use App\Models\Activity;
use App\Models\Committee;
use App\Models\Project;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreActivityRequest extends FormRequest
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

        if (! $project || ! $committee || (int) $committee->project_id !== (int) $project->id) {
            abort(404);
        }

        return $this->user()?->can('create', [Activity::class, $committee]) ?? false;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'title'       => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'start_date'  => ['nullable', 'date'],
            'due_date'    => ['nullable', 'date', 'after_or_equal:start_date'],
            'status'      => ['sometimes', 'string', Rule::in(Activity::STATUSES)],
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
            'title.required'            => 'The activity title is required.',
            'title.max'                 => 'The activity title cannot exceed 255 characters.',
            'start_date.date'           => 'The start date must be a valid date.',
            'due_date.date'             => 'The deadline must be a valid date.',
            'due_date.after_or_equal'   => 'The deadline must not be earlier than the start date.',
            'status.in'                 => 'The selected activity status is invalid.',
        ];
    }
}
