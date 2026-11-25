<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateSkillProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'ratings' => ['required', 'array'],
            'ratings.*.skill_id' => ['required', 'integer', 'exists:skills,id', 'distinct'],
            'ratings.*.rating' => [
                'nullable',
                function ($attribute, $value, $fail) {
                    if ($value === null) {
                        return;
                    }
                    if (is_bool($value)) {
                        $fail('The rating must be an integer between 0 and 4, or unrated.');
                        return;
                    }
                    if (!is_int($value) && (!is_string($value) || !preg_match('/^[0-4]$/', $value))) {
                        $fail('The rating must be an integer between 0 and 4, or unrated.');
                        return;
                    }
                    $intVal = (int) $value;
                    if ($intVal < 0 || $intVal > 4) {
                        $fail('The rating must be between 0 (No experience) and 4 (Highly proficient).');
                    }
                },
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'ratings.required' => 'No skill ratings provided in the request payload.',
            'ratings.*.skill_id.exists' => 'One or more selected skills do not exist in the standardized catalog.',
            'ratings.*.skill_id.distinct' => 'Duplicate skill ratings cannot be submitted in the same request.',
            'ratings.*.rating.between' => 'Skill ratings must be between 0 (No experience) and 4 (Highly proficient), or unrated.',
        ];
    }
}
