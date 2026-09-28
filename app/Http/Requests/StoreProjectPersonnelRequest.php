<?php

namespace App\Http\Requests;

use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreProjectPersonnelRequest extends FormRequest
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

        return $project && $this->user()?->can('update', $project);
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $projectId = $this->route('project') instanceof Project
            ? $this->route('project')->id
            : $this->route('project');

        return [
            'user_id' => [
                'required',
                'integer',
                'exists:users,id',
                function ($attribute, $value, $fail) use ($projectId) {
                    $user = User::find($value);
                    if (! $user || ! $user->hasVerifiedEmail()) {
                        $fail('The user must have a verified institutional email address.');
                        return;
                    }

                    $project = Project::find($projectId);
                    if ($project && (int) $project->created_by === (int) $value) {
                        $fail('The Project Leader assignment cannot be changed.');
                        return;
                    }

                    $isLeader = ProjectRoleAssignment::where('project_id', $projectId)
                        ->where('user_id', $value)
                        ->where('role', ProjectRoleAssignment::ROLE_PROJECT_LEADER)
                        ->exists();

                    if ($isLeader) {
                        $fail('The Project Leader assignment cannot be changed.');
                    }
                },
            ],
            'role' => [
                'required',
                'string',
                Rule::in([
                    ProjectRoleAssignment::ROLE_PROJECT_STAFF,
                    ProjectRoleAssignment::ROLE_PROJECT_MEMBER,
                ]),
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
            'user_id.required' => 'A valid user must be selected.',
            'user_id.exists' => 'The selected user was not found.',
            'role.required' => 'A project role must be selected.',
            'role.in' => 'The role must be either Project Staff or Project Member.',
        ];
    }
}
