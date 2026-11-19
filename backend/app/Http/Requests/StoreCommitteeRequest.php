<?php

namespace App\Http\Requests;

use App\Models\Committee;
use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;

class StoreCommitteeRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     * Only the Overall Chair can create a committee and assign chair/co-chair.
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
     * Prepare data for validation.
     */
    protected function prepareForValidation(): void
    {
        if ($this->has('chair_id') && ! $this->has('user_id')) {
            $this->merge(['user_id' => $this->input('chair_id')]);
        }
        if ($this->has('co_chair_user_id') && ! $this->has('co_chair_id')) {
            $this->merge(['co_chair_id' => $this->input('co_chair_user_id')]);
        }
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $project = $this->route('project') instanceof Project
            ? $this->route('project')
            : Project::find($this->route('project'));

        $leaderId = $project?->created_by;
        $projectId = $project?->id;

        return [
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'user_id' => [
                'nullable',
                'integer',
                'exists:users,id',
                function ($attribute, $value, $fail) use ($leaderId, $projectId) {
                    if (! $value) {
                        return;
                    }

                    $user = User::find($value);
                    if (! $user || ! $user->hasVerifiedEmail()) {
                        $fail('The selected chairperson must have a verified institutional email address.');
                        return;
                    }

                    if ((int) $value === (int) $leaderId) {
                        $fail('The Overall Chair cannot be assigned as a Committee Chairperson.');
                        return;
                    }

                    if ($projectId) {
                        $isLeader = ProjectRoleAssignment::where('project_id', $projectId)
                            ->where('user_id', $value)
                            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_LEADER)
                            ->exists();
                        if ($isLeader) {
                            $fail('The Overall Chair cannot be assigned as a Committee Chairperson.');
                        }
                    }
                },
            ],
            'co_chair_id' => [
                'nullable',
                'integer',
                'different:user_id',
                'exists:users,id',
                function ($attribute, $value, $fail) use ($leaderId, $projectId) {
                    if (! $value) {
                        return;
                    }

                    $user = User::find($value);
                    if (! $user || ! $user->hasVerifiedEmail()) {
                        $fail('The selected Co-Chair must have a verified institutional email address.');
                        return;
                    }

                    if ((int) $value === (int) $leaderId) {
                        $fail('The Overall Chair cannot be designated as a Committee Co-Chair.');
                        return;
                    }

                    if ($projectId) {
                        $isLeader = ProjectRoleAssignment::where('project_id', $projectId)
                            ->where('user_id', $value)
                            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_LEADER)
                            ->exists();
                        if ($isLeader) {
                            $fail('The Overall Chair cannot be designated as a Committee Co-Chair.');
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
            'name.required' => 'The committee name is required.',
            'name.max' => 'The committee name cannot exceed 255 characters.',
            'user_id.exists' => 'The selected chairperson does not exist.',
            'co_chair_id.exists' => 'The selected Co-Chair does not exist.',
            'co_chair_id.different' => 'The Committee Chairperson and Co-Chair cannot be the same person.',
        ];
    }
}
