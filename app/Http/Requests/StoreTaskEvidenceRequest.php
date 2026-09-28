<?php

namespace App\Http\Requests;

use App\Models\Activity;
use App\Models\Committee;
use App\Models\Project;
use App\Models\Task;
use Illuminate\Foundation\Http\FormRequest;

class StoreTaskEvidenceRequest extends FormRequest
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

        return $this->user()?->can('uploadEvidence', $task) ?? false;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'file' => ['required', 'file', 'max:10240', 'mimes:pdf,doc,docx,jpg,jpeg,png,txt,xls,xlsx,zip'],
            'remarks' => ['nullable', 'string', 'max:500'],
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
            'file.required' => 'Please select an evidence file to upload.',
            'file.file' => 'The uploaded evidence must be a valid file.',
            'file.max' => 'The evidence file size must not exceed 10MB.',
            'file.mimes' => 'The evidence file must be of type: pdf, doc, docx, jpg, jpeg, png, txt, xls, xlsx, zip.',
            'remarks.max' => 'Remarks cannot exceed 500 characters.',
        ];
    }
}
