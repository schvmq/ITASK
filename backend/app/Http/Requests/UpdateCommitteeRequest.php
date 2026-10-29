<?php

namespace App\Http\Requests;

use App\Models\Committee;
use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;

class UpdateCommitteeRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        $committee = $this->route('committee');
        if (! $committee instanceof Committee) {
            $committee = Committee::find($committee);
        }

        if (! $committee) {
            return false;
        }

        if ($this->routeIs('*staff*') || ($this->has('user_id') && ! $this->has('name'))) {
            return (bool) $this->user()?->can('manageMembers', $committee);
        }

        return (bool) $this->user()?->can('update', $committee);
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
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'user_id' => [
                'nullable',
                'integer',
                'exists:users,id',
                function ($attribute, $value, $fail) use ($projectId) {
                    if (! $value) {
                        return;
                    }

                    $user = User::find($value);
                    if (! $user || ! $user->hasVerifiedEmail()) {
                        $fail('The selected staff member must have a verified institutional email address.');
                        return;
                    }

                    $isInProject = ProjectRoleAssignment::where('project_id', $projectId)
                        ->where('user_id', $value)
                        ->exists();

                    if (! $isInProject) {
                        $fail('The selected user must be an assigned member of this project.');
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
            'user_id.exists' => 'The selected staff member does not exist.',
        ];
    }
}
