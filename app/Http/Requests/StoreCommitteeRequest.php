<?php

namespace App\Http\Requests;

use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;

class StoreCommitteeRequest extends FormRequest
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

        return $project && $this->user()?->can('create', [Committee::class, $project]);
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
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'user_id' => [
                'required',
                'integer',
                'exists:users,id',
                function ($attribute, $value, $fail) use ($projectId) {
                    $user = User::find($value);
                    if (! $user || ! $user->hasVerifiedEmail()) {
                        $fail('The selected staff member must have a verified institutional email address.');
                        return;
                    }

                    $isStaff = ProjectRoleAssignment::where('project_id', $projectId)
                        ->where('user_id', $value)
                        ->where('role', ProjectRoleAssignment::ROLE_PROJECT_STAFF)
                        ->exists();

                    if (! $isStaff) {
                        $fail('The selected user must be an assigned Project Staff member of this project.');
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
            'name.required' => 'The committee name is required.',
            'name.max' => 'The committee name cannot exceed 255 characters.',
            'user_id.required' => 'A Project Staff member must be selected to head the committee.',
            'user_id.exists' => 'The selected staff member does not exist.',
        ];
    }
}
