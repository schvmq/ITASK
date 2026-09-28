<?php

namespace App\Http\Requests;

use App\Models\Committee;
use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;

class AssignCommitteeMemberRequest extends FormRequest
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

        return $committee && $this->user()?->can('manageMembers', $committee);
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

        $committee = $this->route('committee');
        $committeeId = $committee instanceof Committee ? $committee->id : $committee;

        return [
            'user_id' => [
                'required',
                'integer',
                'exists:users,id',
                function ($attribute, $value, $fail) use ($projectId, $committeeId) {
                    $user = User::find($value);
                    if (! $user || ! $user->hasVerifiedEmail()) {
                        $fail('The selected member must have a verified institutional email address.');
                        return;
                    }

                    $memberAssignment = ProjectRoleAssignment::where('project_id', $projectId)
                        ->where('user_id', $value)
                        ->where('role', ProjectRoleAssignment::ROLE_PROJECT_MEMBER)
                        ->first();

                    if (! $memberAssignment) {
                        $fail('The selected user must be an assigned Project Member of this project.');
                        return;
                    }

                    if ((int) $memberAssignment->committee_id === (int) $committeeId) {
                        $fail('The user is already assigned to this committee.');
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
            'user_id.required' => 'A Project Member must be selected to join the committee.',
            'user_id.exists' => 'The selected member does not exist.',
        ];
    }
}
