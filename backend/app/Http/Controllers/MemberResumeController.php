<?php

namespace App\Http\Controllers;

use App\Models\MemberResume;
use App\Models\User;
use App\Services\AI\OllamaResumeScreeningService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;

class MemberResumeController extends Controller
{
    public function __construct(
        protected OllamaResumeScreeningService $screeningService
    ) {}

    /**
     * Upload and screen a member's resume/CV.
     */
    public function upload(Request $request, User $user): JsonResponse
    {
        $currentUser = Auth::user();

        // Allow user to upload their own resume, or admin/project leader
        if ($currentUser->id !== $user->id && !$currentUser->isAdmin()) {
            abort(403, 'Unauthorized to upload resume for this user.');
        }

        $request->validate([
            'resume' => 'required|file|mimes:pdf,png,jpg,jpeg,docx,txt|max:10240', // 10MB
        ]);

        $file = $request->file('resume');
        $originalName = $file->getClientOriginalName();
        $mimeType = $file->getClientMimeType() ?: $file->getMimeType();
        $fileSize = $file->getSize();

        // Store file safely in storage/app/resumes
        $path = $file->store("resumes/{$user->id}", 'local');

        // Extract skills and qualifications via Ollama
        $analysis = $this->screeningService->extractResumeData($path, $mimeType, $originalName);

        // Save or update MemberResume
        $memberResume = MemberResume::updateOrCreate(
            ['user_id' => $user->id],
            [
                'original_name' => $originalName,
                'file_path' => $path,
                'file_size' => $fileSize,
                'mime_type' => $mimeType,
                'extracted_text' => $analysis['extracted_text'] ?? '',
                'extracted_skills' => $analysis['extracted_skills'] ?? [],
                'certifications' => $analysis['certifications'] ?? [],
                'experience_summary' => $analysis['experience_summary'] ?? '',
                'eligibility_status' => $analysis['eligibility_status'] ?? 'Eligible',
                'raw_ai_analysis' => $analysis['raw_ai_analysis'] ?? null,
            ]
        );

        return response()->json([
            'success' => true,
            'message' => 'Resume uploaded and analyzed successfully.',
            'resume' => [
                'id' => $memberResume->id,
                'original_name' => $memberResume->original_name,
                'skills' => $memberResume->extracted_skills,
                'certifications' => $memberResume->certifications,
                'experience_summary' => $memberResume->experience_summary,
                'eligibility_status' => $memberResume->eligibility_status,
            ],
        ]);
    }

    /**
     * Get member resume summary.
     */
    public function show(User $user): JsonResponse
    {
        $resume = $user->resume;

        if (!$resume) {
            return response()->json([
                'has_resume' => false,
            ]);
        }

        return response()->json([
            'has_resume' => true,
            'original_name' => $resume->original_name,
            'skills' => $resume->extracted_skills ?? [],
            'certifications' => $resume->certifications ?? [],
            'experience_summary' => $resume->experience_summary,
            'eligibility_status' => $resume->eligibility_status,
            'uploaded_at' => $resume->updated_at->toIso8601String(),
        ]);
    }
}
