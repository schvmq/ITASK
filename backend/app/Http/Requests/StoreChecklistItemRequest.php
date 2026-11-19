<?php

namespace App\Http\Requests;

use App\Models\Activity;
use App\Models\ChecklistItem;
use App\Models\Committee;
use App\Models\Project;
use App\Models\Task;
use Illuminate\Foundation\Http\FormRequest;

class StoreChecklistItemRequest extends FormRequest
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

        return $this->user()?->can('create', [ChecklistItem::class, $task]) ?? false;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'content'      => ['required', 'string', 'max:500'],
            'is_completed' => ['sometimes', 'boolean'],
            'order'        => ['sometimes', 'integer', 'min:0'],
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
            'content.required' => 'The checklist item content is required.',
            'content.max'      => 'Checklist item content cannot exceed 500 characters.',
            'is_completed.boolean' => 'The completion state must be true or false.',
        ];
    }
}
