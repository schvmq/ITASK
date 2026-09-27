<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreProjectRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date', 'after_or_equal:start_date'],
            'approval_document' => [
                'required',
                'file',
                'mimes:pdf,doc,docx,jpg,jpeg,png',
                'max:10240', // 10 MB maximum
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
            'approval_document.required' => 'The project approval/supporting document is required.',
            'approval_document.file' => 'The project approval/supporting document must be a valid file.',
            'approval_document.mimes' => 'The approval document must be a file of type: pdf, doc, docx, jpg, jpeg, png.',
            'approval_document.max' => 'The approval document must not exceed 10 MB in file size.',
            'end_date.after_or_equal' => 'The end date must not be before the start date.',
        ];
    }
}
