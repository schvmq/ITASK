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

        $rules = [];

        if ($this->has('user_ids') && is_array($this->input('user_ids'))) {
            $rules['user_ids'] = ['required', 'array', 'min:1'];
            $rules['user_ids.*'] = [
                'integer',
                'distinct',
                'exists:users,id',
                function ($attribute, $value, $fail) use ($projectId, $committeeId) {
                    $this->validateMemberId($value, $projectId, $committeeId, $fail);
                },
            ];
        } else {
            $rules['user_id'] = [
                'required',
                function ($attribute, $value, $fail) use ($projectId, $committeeId) {
                    if (is_array($value)) {
                        if (empty($value)) {
                            $fail('A Project Member must be selected to join the committee.');
                            return;
                        }
                        if (count($value) !== count(array_unique($value))) {
                            $fail('Duplicate members cannot be selected.');
                            return;
                        }
                        foreach ($value as $id) {
                            $this->validateMemberId($id, $projectId, $committeeId, $fail);
                        }
                    } else {
                        if (! is_numeric($value)) {
                            $fail('The selected member does not exist.');
                            return;
                        }
                        $this->validateMemberId($value, $projectId, $committeeId, $fail);
                    }
                },
            ];
        }

        return $rules;
    }

    /**
     * Validate an individual member ID.
     */
    protected function validateMemberId($id, $projectId, $committeeId, $fail): void
    {
        $user = User::find($id);
        if (! $user || ! $user->hasVerifiedEmail()) {
            $fail('The selected member must have a verified institutional email address.');
            return;
        }

        $memberAssignment = ProjectRoleAssignment::where('project_id', $projectId)
            ->where('user_id', $id)
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_MEMBER)
            ->first();

        if (! $memberAssignment) {
            $fail('The selected user must be an assigned Project Member of this project.');
            return;
        }

        $alreadyInCommittee = ProjectRoleAssignment::where('project_id', $projectId)
            ->where('committee_id', $committeeId)
            ->where('user_id', $id)
            ->where('role', ProjectRoleAssignment::ROLE_PROJECT_MEMBER)
            ->exists();

        if ($alreadyInCommittee) {
            $fail('The user is already assigned to this committee.');
        }
    }

    /**
     * Get the unique list of validated member user IDs.
     *
     * @return array<int>
     */
    public function validatedUserIds(): array
    {
        $ids = [];
        if ($this->has('user_ids') && is_array($this->input('user_ids'))) {
            $ids = array_merge($ids, $this->input('user_ids'));
        } elseif ($this->has('user_id')) {
            $val = $this->input('user_id');
            if (is_array($val)) {
                $ids = array_merge($ids, $val);
            } elseif ($val !== null && $val !== '') {
                $ids[] = (int) $val;
            }
        }

        return array_values(array_unique(array_map('intval', $ids)));
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
            'user_ids.required' => 'At least one Project Member must be selected.',
            'user_ids.*.distinct' => 'Duplicate members cannot be selected in the same request.',
            'user_id.exists' => 'The selected member does not exist.',
        ];
    }
}
