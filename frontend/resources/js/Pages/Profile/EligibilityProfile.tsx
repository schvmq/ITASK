import React, { useMemo, useRef, useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import axios from 'axios';
import {
    Award,
    Check,
    Cpu,
    FileCheck,
    FileText,
    Plus,
    Save,
    Sparkles,
    UploadCloud,
    X,
} from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { Alert } from '@/Components/Alert';
import { Badge } from '@/Components/Badge';
import { Button } from '@/Components/Button';
import { Card } from '@/Components/Card';
import { Input } from '@/Components/Input';
import { InputError } from '@/Components/InputError';
import { Label } from '@/Components/Label';
import { BadgeVariant, PageProps } from '@/types';

export interface ProfileData {
    has_resume: boolean;
    has_questionnaire: boolean;
    original_name: string | null;
    extracted_skills: string[];
    certifications: string[];
    cv_certifications: string[];
    experience_summary: string | null;
    eligibility_status: string | null;
    strengths_assessment: Record<string, number>;
    preferred_task_categories: string[];
    leadership_readiness: string | null;
    availability_hours: string | null;
    deliberation_notes: string | null;
    assessment_completed_at: string | null;
}

export interface CompetencyDomain {
    slug: string;
    label: string;
    keywords: string[];
    examples: string;
}

export interface FrameworkData {
    domains: CompetencyDomain[];
    task_categories: string[];
    leadership_options: string[];
    availability_options: string[];
}

export interface SampleDeliberationTask {
    title: string;
    committee: string;
    description: string;
    domains: string[];
}

export interface EligibilityProfileProps {
    profile: ProfileData;
    framework: FrameworkData;
    sampleDeliberationTasks: SampleDeliberationTask[];
    ollamaActive: boolean;
}

interface FeedbackState {
    variant: 'success' | 'danger';
    message: string;
}

interface TaskPreviewEvaluation {
    task: SampleDeliberationTask;
    score: number;
    status: 'Highly Recommended' | 'Eligible';
    highlights: string[];
    reason: string;
    verificationLabel: string;
}

const RATING_ANCHORS: Record<number, string> = {
    1: 'Beginner',
    2: 'Developing',
    3: 'Competent',
    4: 'Proficient',
    5: 'Lead-Ready',
};

const TASK_CATEGORY_TO_DOMAIN: Record<string, string> = {
    'Web & System Setup': 'technical_engineering',
    'Quality & Evidence Audit': 'quality_assurance',
    'Documentation & Minutes': 'documentation_secretariat',
    'Event Logistics': 'logistics_operations',
    'Committee Coordination': 'leadership_facilitation',
    'Media & Visual Production': 'media_creative',
};

const MAX_DELIBERATION_NOTES = 1500;
const MAX_CERTIFICATION_LENGTH = 150;
const MAX_CV_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_CV_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.docx', '.txt'];

function buildInitialRatings(
    domains: CompetencyDomain[],
    saved: Record<string, number> | undefined
): Record<string, number> {
    const initial: Record<string, number> = {};
    for (const domain of domains) {
        const raw = saved?.[domain.slug];
        const parsed = typeof raw === 'number' ? Math.round(raw) : Number(raw);
        initial[domain.slug] = Number.isInteger(parsed) && parsed >= 1 && parsed <= 5 ? parsed : 3;
    }
    return initial;
}

function extractSelfEnteredCertifications(profile: ProfileData): string[] {
    const cvSet = new Set((profile.cv_certifications ?? []).map((item) => item.trim()));
    const seen = new Set<string>();
    const result: string[] = [];

    for (const cert of profile.certifications ?? []) {
        const trimmed = cert.trim();
        if (trimmed && !cvSet.has(trimmed) && !seen.has(trimmed)) {
            seen.add(trimmed);
            result.push(trimmed);
        }
    }
    return result;
}

function formatAssessmentDate(isoDate: string | null): string {
    if (!isoDate) return 'Not completed yet';
    const parsed = new Date(isoDate);
    if (Number.isNaN(parsed.getTime())) return 'Saved';
    return parsed.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getEligibilityBadgeVariant(status: string | null): BadgeVariant {
    if (status === 'Highly Recommended') return 'success';
    if (status === 'Needs Verification') return 'warning';
    if (status === 'Eligible') return 'primary';
    return 'neutral';
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countKeywordMatches(text: string, keywords: string[]): number {
    let hits = 0;
    for (const keyword of keywords) {
        const pattern = new RegExp(`\\b${escapeRegExp(keyword.toLowerCase())}`, 'i');
        if (pattern.test(text)) {
            hits += 1;
        }
    }
    return hits;
}

function phraseMatchesText(phrase: string, text: string): boolean {
    const normalized = phrase.trim().toLowerCase();
    if (!normalized) return false;

    const exactPattern = new RegExp(`\\b${escapeRegExp(normalized)}`, 'i');
    if (exactPattern.test(text)) return true;

    const stopWords = new Set(['and', 'for', 'the', 'with', 'setup', 'audit', 'role']);
    const words = normalized.split(/[\s&,/-]+/).filter(Boolean);
    return words.some(
        (word) =>
            word.length >= 3 &&
            !stopWords.has(word) &&
            new RegExp(`\\b${escapeRegExp(word)}`, 'i').test(text)
    );
}

function countSignificantTokenMatches(sourceText: string, targetText: string): number {
    const stopWords = new Set([
        'with', 'from', 'that', 'this', 'have', 'been', 'will', 'your', 'their',
        'about', 'under', 'carsu', 'member', 'experienced', 'built', 'handled',
        'support', 'role', 'general', 'tools', 'events', 'event', 'committee',
    ]);

    const tokens = sourceText.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    const matched = new Set<string>();

    for (const token of tokens) {
        if (token.length >= 4 && !stopWords.has(token)) {
            const stem = token.length > 5 ? token.slice(0, -1) : token;
            if (new RegExp(`\\b${escapeRegExp(stem)}`, 'i').test(targetText)) {
                matched.add(token);
            }
        }
    }
    return matched.size;
}

function evaluateTaskFitPreview(params: {
    task: SampleDeliberationTask;
    domains: CompetencyDomain[];
    taskCategories: string[];
    strengthRatings: Record<string, number>;
    preferredCategories: string[];
    cvCertifications: string[];
    selfCertifications: string[];
    extractedSkills: string[];
    deliberationNotes: string;
    experienceSummary: string | null;
    leadershipReadiness: string;
    hasResume: boolean;
}): TaskPreviewEvaluation {
    const {
        task,
        domains,
        taskCategories,
        strengthRatings,
        preferredCategories,
        cvCertifications,
        selfCertifications,
        extractedSkills,
        deliberationNotes,
        experienceSummary,
        leadershipReadiness,
        hasResume,
    } = params;

    const targetText = `${task.title} ${task.description}`.toLowerCase();
    const highlights: string[] = [];
    const domainBySlug = new Map(domains.map((d) => [d.slug, d]));

    let totalScopeWeight = 0;
    let weightedAlignment = 0;

    for (const domain of domains) {
        const keywordHits = countKeywordMatches(targetText, domain.keywords);
        const explicitDomainHint = task.domains.includes(domain.slug) && keywordHits === 0 ? 1 : 0;
        const hits = keywordHits + explicitDomainHint;

        if (hits > 0 && strengthRatings[domain.slug] !== undefined) {
            const weight = Math.min(4, hits);
            const rating = Math.max(1, Math.min(5, strengthRatings[domain.slug]));
            totalScopeWeight += weight;
            weightedAlignment += weight * ((rating - 1) / 4);

            if (rating >= 4) {
                highlights.push(domain.label);
            }
        }
    }

    let domainScore = 0;
    if (totalScopeWeight > 0) {
        domainScore = Math.round(20 * (weightedAlignment / totalScopeWeight));
    } else if (domains.length > 0) {
        const ratings = domains.map((d) => strengthRatings[d.slug] ?? 3);
        const avg = ratings.reduce((sum, val) => sum + val, 0) / ratings.length;
        domainScore = Math.round(5 * ((avg - 1) / 4));
    }

    let skillCategoryScore = 0;
    for (const category of preferredCategories) {
        const mappedSlug = TASK_CATEGORY_TO_DOMAIN[category];
        const mappedDomain = mappedSlug ? domainBySlug.get(mappedSlug) : undefined;
        const domainMatches =
            mappedDomain &&
            (countKeywordMatches(targetText, mappedDomain.keywords) > 0 ||
                task.domains.includes(mappedDomain.slug));

        if (domainMatches || phraseMatchesText(category, targetText)) {
            skillCategoryScore += 6;
            highlights.push(category);
        }
    }

    const canonicalLabels = new Set([
        ...domains.map((d) => d.label),
        ...taskCategories,
        ...preferredCategories,
    ]);

    for (const skill of extractedSkills) {
        if (canonicalLabels.has(skill)) continue;
        if (phraseMatchesText(skill, targetText)) {
            skillCategoryScore += 8;
            highlights.push(skill);
        }
    }

    const notesAndExperience = `${deliberationNotes} ${experienceSummary ?? ''}`.trim();
    if (notesAndExperience) {
        const tokenHits = countSignificantTokenMatches(notesAndExperience, targetText);
        skillCategoryScore += Math.min(6, tokenHits * 3);
    }
    skillCategoryScore = Math.min(20, skillCategoryScore);

    const combinedCerts = Array.from(new Set([...cvCertifications, ...selfCertifications]));
    let evidenceScore = 0;
    if (hasResume) {
        evidenceScore += 8;
    }
    if (combinedCerts.length > 0) {
        const certMatched = combinedCerts.some((cert) => phraseMatchesText(cert, targetText));
        evidenceScore += certMatched ? 5 : 4;
    }
    if (deliberationNotes.trim().length >= 15) {
        evidenceScore += 2;
    }
    if (leadershipReadiness === 'Lead or Independent') {
        evidenceScore += 2;
    } else if (leadershipReadiness === 'Co-Lead / Active Contributor') {
        evidenceScore += 1;
    }
    evidenceScore = Math.min(14, evidenceScore);

    let score = Math.max(45, Math.min(98, 50 + domainScore + skillCategoryScore + evidenceScore));
    if (!hasResume && combinedCerts.length === 0) {
        score = Math.min(84, score);
    }

    const uniqueHighlights = Array.from(new Set(highlights)).slice(0, 3);
    const status: 'Highly Recommended' | 'Eligible' =
        score >= 85 ? 'Highly Recommended' : 'Eligible';

    const verificationLabel = hasResume
        ? 'Supported by uploaded CV & current answers'
        : selfCertifications.length > 0
          ? 'Based on self-entered credentials (not CV-verified)'
          : 'Based on current self-assessed answers';

    const reason =
        uniqueHighlights.length > 0
            ? `Strong alignment via ${uniqueHighlights.join(', ')}. ${verificationLabel}.`
            : `Baseline match for general committee execution. ${verificationLabel}.`;

    return {
        task,
        score,
        status,
        highlights: uniqueHighlights,
        reason,
        verificationLabel,
    };
}

export default function EligibilityProfile({
    profile,
    framework,
    sampleDeliberationTasks = [],
    ollamaActive = false,
}: EligibilityProfileProps) {
    const { auth } = usePage<PageProps>().props;
    const authUser = auth?.user ?? null;

    const [strengthRatings, setStrengthRatings] = useState<Record<string, number>>(() =>
        buildInitialRatings(framework.domains, profile.strengths_assessment)
    );
    const [preferredCategories, setPreferredCategories] = useState<string[]>(
        () => profile.preferred_task_categories ?? []
    );
    const [selfCertifications, setSelfCertifications] = useState<string[]>(() =>
        extractSelfEnteredCertifications(profile)
    );
    const [certInput, setCertInput] = useState('');
    const [certInputError, setCertInputError] = useState<string | null>(null);

    const [leadershipReadiness, setLeadershipReadiness] = useState<string>(
        () => profile.leadership_readiness || framework.leadership_options[0] || ''
    );
    const [availabilityHours, setAvailabilityHours] = useState<string>(
        () =>
            profile.availability_hours ||
            framework.availability_options[1] ||
            framework.availability_options[0] ||
            ''
    );
    const [deliberationNotes, setDeliberationNotes] = useState<string>(
        () => profile.deliberation_notes ?? ''
    );

    const [isSaving, setIsSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [saveFeedback, setSaveFeedback] = useState<FeedbackState | null>(null);
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

    const [selectedCvFile, setSelectedCvFile] = useState<File | null>(null);
    const [isUploadingCv, setIsUploadingCv] = useState(false);
    const [cvFeedback, setCvFeedback] = useState<FeedbackState | null>(null);

    const cvFileInputRef = useRef<HTMLInputElement>(null);
    const radioRefs = useRef<Record<string, Record<number, HTMLButtonElement | null>>>({});

    const cvCertifications = useMemo(
        () => profile.cv_certifications ?? [],
        [profile.cv_certifications]
    );

    const topStrengthsCount = useMemo(
        () =>
            framework.domains.filter((domain) => (strengthRatings[domain.slug] ?? 3) >= 4).length,
        [framework.domains, strengthRatings]
    );

    const previewItems = useMemo(() => {
        return sampleDeliberationTasks
            .map((task, index) => ({
                index,
                evaluation: evaluateTaskFitPreview({
                    task,
                    domains: framework.domains,
                    taskCategories: framework.task_categories,
                    strengthRatings,
                    preferredCategories,
                    cvCertifications,
                    selfCertifications,
                    extractedSkills: profile.extracted_skills ?? [],
                    deliberationNotes,
                    experienceSummary: profile.experience_summary,
                    leadershipReadiness,
                    hasResume: profile.has_resume,
                }),
            }))
            .sort(
                (a, b) =>
                    b.evaluation.score - a.evaluation.score || a.index - b.index
            )
            .map((entry) => entry.evaluation);
    }, [
        sampleDeliberationTasks,
        framework.domains,
        framework.task_categories,
        strengthRatings,
        preferredCategories,
        cvCertifications,
        selfCertifications,
        profile.extracted_skills,
        profile.experience_summary,
        profile.has_resume,
        deliberationNotes,
        leadershipReadiness,
    ]);

    const handleRatingChange = (slug: string, rating: number) => {
        setStrengthRatings((prev) => ({ ...prev, [slug]: rating }));
        setIsDirty(true);
        setSaveFeedback(null);
        setValidationErrors((prev) => {
            if (!prev.strength_ratings && !prev[`strength_ratings.${slug}`]) return prev;
            const next = { ...prev };
            delete next.strength_ratings;
            delete next[`strength_ratings.${slug}`];
            return next;
        });
    };

    const handleRatingKeyDown = (
        e: React.KeyboardEvent<HTMLButtonElement>,
        slug: string,
        currentValue: number
    ) => {
        let nextValue: number | null = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            nextValue = currentValue >= 5 ? 1 : currentValue + 1;
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            nextValue = currentValue <= 1 ? 5 : currentValue - 1;
        } else if (e.key === 'Home') {
            nextValue = 1;
        } else if (e.key === 'End') {
            nextValue = 5;
        }

        if (nextValue !== null) {
            e.preventDefault();
            handleRatingChange(slug, nextValue);
            radioRefs.current[slug]?.[nextValue]?.focus();
        }
    };

    const handleToggleCategory = (category: string) => {
        setPreferredCategories((prev) =>
            prev.includes(category)
                ? prev.filter((item) => item !== category)
                : [...prev, category]
        );
        setIsDirty(true);
        setSaveFeedback(null);
        setValidationErrors((prev) => {
            if (!prev.preferred_task_categories) return prev;
            const next = { ...prev };
            delete next.preferred_task_categories;
            return next;
        });
    };

    const handleAddCertification = () => {
        const trimmed = certInput.trim();
        if (!trimmed) {
            setCertInputError('Enter a training or certificate name before adding.');
            return;
        }
        if (trimmed.length > MAX_CERTIFICATION_LENGTH) {
            setCertInputError(`Certification name must be ${MAX_CERTIFICATION_LENGTH} characters or fewer.`);
            return;
        }

        const lower = trimmed.toLowerCase();
        if (selfCertifications.some((item) => item.toLowerCase() === lower)) {
            setCertInputError('This certification is already in your list.');
            return;
        }
        if (cvCertifications.some((item) => item.toLowerCase() === lower)) {
            setCertInputError('This credential is already captured from your uploaded CV.');
            return;
        }

        setSelfCertifications((prev) => [...prev, trimmed]);
        setCertInput('');
        setCertInputError(null);
        setIsDirty(true);
        setSaveFeedback(null);
        setValidationErrors((prev) => {
            if (!prev.certifications_list) return prev;
            const next = { ...prev };
            delete next.certifications_list;
            return next;
        });
    };

    const handleCertInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddCertification();
        }
    };

    const handleRemoveCertification = (cert: string) => {
        setSelfCertifications((prev) => prev.filter((item) => item !== cert));
        setIsDirty(true);
        setSaveFeedback(null);
    };

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setSaveFeedback(null);
        setValidationErrors({});

        try {
            const response = await axios.post('/eligibility-profile', {
                strength_ratings: strengthRatings,
                preferred_task_categories: preferredCategories,
                certifications_list: selfCertifications,
                leadership_readiness: leadershipReadiness,
                availability_hours: availabilityHours,
                deliberation_notes: deliberationNotes,
            });

            const data = response.data;

            if (data.profile) {
                setStrengthRatings(
                    buildInitialRatings(framework.domains, data.profile.strengths_assessment)
                );
                setPreferredCategories(data.profile.preferred_task_categories ?? []);
                setSelfCertifications(extractSelfEnteredCertifications(data.profile));
                setLeadershipReadiness(
                    data.profile.leadership_readiness || framework.leadership_options[0] || ''
                );
                setAvailabilityHours(
                    data.profile.availability_hours ||
                        framework.availability_options[1] ||
                        framework.availability_options[0] ||
                        ''
                );
                setDeliberationNotes(data.profile.deliberation_notes ?? '');
            }

            setIsDirty(false);
            setSaveFeedback({
                variant: 'success',
                message: data.message || 'Eligibility & strengths profile saved successfully.',
            });
            router.reload({ only: ['profile'] });
        } catch (err: any) {
            if (err.response?.status === 422) {
                const parsedErrors: Record<string, string> = {};
                const errors = err.response?.data?.errors;
                if (errors && typeof errors === 'object') {
                    for (const [key, messages] of Object.entries(errors)) {
                        if (Array.isArray(messages) && messages.length > 0) {
                            parsedErrors[key] = String(messages[0]);
                        }
                    }
                }
                setValidationErrors(parsedErrors);
                setSaveFeedback({
                    variant: 'danger',
                    message:
                        err.response?.data?.message ||
                        'Please fix the highlighted fields before saving your profile.',
                });
                return;
            }

            if (err.response?.status === 419) {
                setSaveFeedback({
                    variant: 'danger',
                    message:
                        'Your session expired. Refresh this page and submit your answers again.',
                });
                return;
            }

            setSaveFeedback({
                variant: 'danger',
                message:
                    err.response?.data?.message ||
                    err.message ||
                    'Could not save your eligibility profile. Please try again.',
            });
            return;
        } finally {
            setIsSaving(false);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] ?? null;
        setCvFeedback(null);

        if (!file) {
            setSelectedCvFile(null);
            return;
        }

        const lowerName = file.name.toLowerCase();
        const hasValidExt = ALLOWED_CV_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
        if (!hasValidExt) {
            setSelectedCvFile(null);
            if (cvFileInputRef.current) {
                cvFileInputRef.current.value = '';
            }
            setCvFeedback({
                variant: 'danger',
                message: 'Unsupported file type. Upload a PDF, PNG, JPG, DOCX, or TXT resume.',
            });
            return;
        }

        if (file.size > MAX_CV_FILE_BYTES) {
            setSelectedCvFile(null);
            if (cvFileInputRef.current) {
                cvFileInputRef.current.value = '';
            }
            setCvFeedback({
                variant: 'danger',
                message: 'File exceeds the 10 MB upload limit. Choose a smaller document.',
            });
            return;
        }

        setSelectedCvFile(file);
    };

    const handleCvUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!authUser?.id) {
            setCvFeedback({
                variant: 'danger',
                message: 'User session unavailable. Refresh the page and try again.',
            });
            return;
        }
        if (!selectedCvFile) {
            setCvFeedback({
                variant: 'danger',
                message: 'Select a PDF, image, Word, or text CV before scanning.',
            });
            return;
        }

        setIsUploadingCv(true);
        setCvFeedback(null);

        const formData = new FormData();
        formData.append('resume', selectedCvFile);

        try {
            const response = await axios.post(`/users/${authUser.id}/resume`, formData);

            const data = response.data;

            setSelectedCvFile(null);
            if (cvFileInputRef.current) {
                cvFileInputRef.current.value = '';
            }
            setCvFeedback({
                variant: 'success',
                message: data.message || 'Resume uploaded and analyzed successfully.',
            });
            router.reload({ only: ['profile'] });
        } catch (err: any) {
            if (err.response?.status === 422) {
                const resumeErr = err.response?.data?.errors?.resume?.[0];
                setCvFeedback({
                    variant: 'danger',
                    message:
                        resumeErr ||
                        err.response?.data?.message ||
                        'Invalid CV file. Accepted formats: PDF, PNG, JPG, DOCX, or TXT up to 10 MB.',
                });
                return;
            }

            if (err.response?.status === 419) {
                setCvFeedback({
                    variant: 'danger',
                    message: 'Session expired. Refresh the page before uploading your CV.',
                });
                return;
            }

            setCvFeedback({
                variant: 'danger',
                message:
                    err.response?.data?.message ||
                    err.message ||
                    'Failed to scan the uploaded CV. Please try again.',
            });
        } finally {
            setIsUploadingCv(false);
        }
    };

    const statusBadgeText = profile.eligibility_status ?? 'Not Yet Assessed';

    return (
        <AppLayout
            title="Eligibility & Strengths"
            subtitle="Answer competency questions and optionally scan your CV to help committee chairs match you to the best tasks."
            breadcrumbs={[{ label: 'Eligibility & Strengths' }]}
        >
            <Head title="Eligibility & Strengths" />

            <div className="space-y-6 pb-8">
                {/* ── Summary Status Strip ── */}
                <section
                    aria-label="Eligibility Profile Summary"
                    className="bg-[color:var(--card)] border border-[color:var(--border)] rounded-[12px] p-4 sm:px-5"
                >
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-0 lg:divide-x lg:divide-[color:var(--border)]">
                        <div className="lg:pr-4 flex flex-col gap-1.5">
                            <span className="text-[12px] font-medium text-[color:var(--muted)]">
                                Eligibility Status
                            </span>
                            <div>
                                <Badge variant={getEligibilityBadgeVariant(profile.eligibility_status)} dot>
                                    {statusBadgeText}
                                </Badge>
                            </div>
                        </div>

                        <div className="lg:px-4 flex flex-col gap-1">
                            <span className="text-[12px] font-medium text-[color:var(--muted)]">
                                Assessment Completed
                            </span>
                            <span className="text-[14px] font-semibold text-[color:var(--text)] tabular-nums">
                                {formatAssessmentDate(profile.assessment_completed_at)}
                            </span>
                        </div>

                        <div className="lg:px-4 flex flex-col gap-1.5">
                            <span className="text-[12px] font-medium text-[color:var(--muted)]">
                                CV Credential Status
                            </span>
                            <div className="flex items-center gap-1.5 text-[14px] font-semibold text-[color:var(--text)]">
                                {profile.has_resume ? (
                                    <>
                                        <FileCheck className="w-4 h-4 text-[color:var(--status-success-text)] shrink-0 stroke-[2px]" />
                                        <span>Attached</span>
                                    </>
                                ) : (
                                    <>
                                        <FileText className="w-4 h-4 text-[color:var(--muted)] shrink-0 stroke-[2px]" />
                                        <span>Questionnaire Only</span>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="lg:px-4 flex flex-col gap-1.5">
                            <span className="text-[12px] font-medium text-[color:var(--muted)]">
                                Screening Engine
                            </span>
                            <div className="flex items-center gap-1.5 text-[14px] font-semibold text-[color:var(--text)]">
                                {ollamaActive ? (
                                    <>
                                        <Sparkles className="w-4 h-4 text-[color:var(--primary)] shrink-0 stroke-[2px]" />
                                        <span>Local Ollama Ready</span>
                                    </>
                                ) : (
                                    <>
                                        <Cpu className="w-4 h-4 text-[color:var(--muted)] shrink-0 stroke-[2px]" />
                                        <span>Heuristic Active</span>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="lg:pl-4 flex flex-col gap-1">
                            <span className="text-[12px] font-medium text-[color:var(--muted)]">
                                Proficient+ Domains
                            </span>
                            <span className="text-[14px] font-semibold text-[color:var(--text)] tabular-nums">
                                {topStrengthsCount} of {framework.domains.length} rated 4+
                            </span>
                        </div>
                    </div>
                </section>

                {/* ── Main Two-Column Workspace ── */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* ── Left Column (2/3): Deliberation Questionnaire Form ── */}
                    <form
                        onSubmit={handleSaveProfile}
                        noValidate
                        className="lg:col-span-8 min-w-0 space-y-6"
                    >
                        {/* Section 1: Core Competency Self-Assessment */}
                        <Card padding="none">
                            <div className="px-4 sm:px-5 py-4 border-b border-[color:var(--border)]">
                                <h2 className="text-[18px] font-semibold text-[color:var(--text)] leading-snug">
                                    Core Competency Self-Assessment
                                </h2>
                                <p className="text-[13px] text-[color:var(--muted)] mt-1 max-w-[70ch]">
                                    Rate each institutional domain from 1 (Beginner) to 5 (Lead-Ready). Use Tab to move between domains and Left/Right arrows to adjust ratings.
                                </p>
                                {validationErrors.strength_ratings && (
                                    <InputError
                                        message={validationErrors.strength_ratings}
                                        className="mt-2"
                                    />
                                )}
                            </div>

                            <div className="divide-y divide-[color:var(--border)]">
                                {framework.domains.map((domain) => {
                                    const currentVal = strengthRatings[domain.slug] ?? 3;
                                    const fieldError =
                                        validationErrors[`strength_ratings.${domain.slug}`];
                                    const descId = `domain-desc-${domain.slug}`;

                                    return (
                                        <div key={domain.slug} className="p-4 sm:px-5 sm:py-4">
                                            <fieldset>
                                            <legend className="text-[15px] font-semibold text-[color:var(--text)] leading-snug">
                                                {domain.label}
                                            </legend>

                                            <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                                                <p
                                                    id={descId}
                                                    className="text-[13px] text-[color:var(--muted)] max-w-[65ch]"
                                                >
                                                    {domain.examples}
                                                </p>
                                                <span className="text-[12px] font-semibold text-[color:var(--text)] bg-[color:var(--soft-surface)] border border-[color:var(--border)] rounded-full px-2.5 py-0.5 tabular-nums shrink-0">
                                                    {currentVal}/5 · {RATING_ANCHORS[currentVal]}
                                                </span>
                                            </div>

                                            <div
                                                role="radiogroup"
                                                aria-label={`${domain.label} proficiency rating`}
                                                aria-describedby={descId}
                                                className="mt-3 grid grid-cols-5 gap-1.5 sm:gap-2"
                                            >
                                                {[1, 2, 3, 4, 5].map((rating) => {
                                                    const isSelected = currentVal === rating;
                                                    return (
                                                        <button
                                                            key={rating}
                                                            ref={(el) => {
                                                                if (!radioRefs.current[domain.slug]) {
                                                                    radioRefs.current[domain.slug] = {};
                                                                }
                                                                radioRefs.current[domain.slug][rating] = el;
                                                            }}
                                                            type="button"
                                                            role="radio"
                                                            aria-checked={isSelected}
                                                            aria-label={`${rating} — ${RATING_ANCHORS[rating]}`}
                                                            tabIndex={isSelected ? 0 : -1}
                                                            onClick={() =>
                                                                handleRatingChange(domain.slug, rating)
                                                            }
                                                            onKeyDown={(e) =>
                                                                handleRatingKeyDown(e, domain.slug, rating)
                                                            }
                                                            className={`min-h-[44px] min-w-[44px] px-1.5 py-2 rounded-[8px] border text-center transition-colors duration-150 cursor-pointer flex flex-col items-center justify-center gap-0.5 focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2 ${
                                                                isSelected
                                                                    ? 'bg-[color:var(--status-primary-bg)] border-[color:var(--primary)] text-[color:var(--text)] font-semibold'
                                                                    : 'bg-[color:var(--soft-surface)] border-[color:var(--border)] text-[color:var(--text)] hover:border-[color:var(--muted)] font-medium'
                                                            }`}
                                                        >
                                                            <span className="text-[14px] font-bold tabular-nums leading-none">
                                                                {rating}
                                                            </span>
                                                            <span className="hidden sm:block text-[12px] leading-tight text-[color:var(--text)]/85 truncate max-w-full">
                                                                {RATING_ANCHORS[rating]}
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            <InputError message={fieldError} className="mt-2" />
                                        </fieldset>
                                        </div>
                                    );
                                })}
                            </div>
                        </Card>

                        {/* Section 2: Preferred Task Categories & Readiness */}
                        <Card padding="none">
                            <div className="px-4 sm:px-5 py-4 border-b border-[color:var(--border)]">
                                <h2 className="text-[18px] font-semibold text-[color:var(--text)] leading-snug">
                                    Preferred Task Categories & Readiness
                                </h2>
                                <p className="text-[13px] text-[color:var(--muted)] mt-1 max-w-[70ch]">
                                    Choose the deliverables you want prioritized when committees assign tasks, plus your leadership role preference and weekly time commitment.
                                </p>
                            </div>

                            <div className="p-4 sm:p-5 space-y-5">
                                <fieldset>
                                    <legend className="text-[13px] font-medium text-[color:var(--text)] mb-2.5">
                                        Preferred Task Categories
                                    </legend>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                        {framework.task_categories.map((category) => {
                                            const isSelected = preferredCategories.includes(category);
                                            return (
                                                <button
                                                    key={category}
                                                    type="button"
                                                    aria-pressed={isSelected}
                                                    onClick={() => handleToggleCategory(category)}
                                                    className={`min-h-[44px] px-3.5 py-2.5 rounded-[8px] border text-left text-[13px] transition-colors duration-150 cursor-pointer flex items-center justify-between gap-2 focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2 ${
                                                        isSelected
                                                            ? 'bg-[color:var(--status-primary-bg)] border-[color:var(--primary)] text-[color:var(--text)] font-semibold'
                                                            : 'bg-[color:var(--soft-surface)] border-[color:var(--border)] text-[color:var(--text)] hover:border-[color:var(--muted)] font-medium'
                                                    }`}
                                                >
                                                    <span className="truncate">{category}</span>
                                                    <span
                                                        className={`w-5 h-5 rounded-[6px] border flex items-center justify-center shrink-0 transition-colors ${
                                                            isSelected
                                                                ? 'bg-[color:var(--primary-btn)] border-[color:var(--primary)] text-white'
                                                                : 'bg-[color:var(--card)] border-[color:var(--border)] text-transparent'
                                                        }`}
                                                        aria-hidden="true"
                                                    >
                                                        <Check className="w-3.5 h-3.5 stroke-[2.5px]" />
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <InputError
                                        message={validationErrors.preferred_task_categories}
                                        className="mt-2"
                                    />
                                </fieldset>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[color:var(--border)]">
                                    <div>
                                        <Label htmlFor="leadership-readiness" required>
                                            Leadership Readiness
                                        </Label>
                                        <select
                                            id="leadership-readiness"
                                            value={leadershipReadiness}
                                            onChange={(e) => {
                                                setLeadershipReadiness(e.target.value);
                                                setIsDirty(true);
                                                setSaveFeedback(null);
                                                setValidationErrors((prev) => {
                                                    if (!prev.leadership_readiness) return prev;
                                                    const next = { ...prev };
                                                    delete next.leadership_readiness;
                                                    return next;
                                                });
                                            }}
                                            className="w-full min-h-[44px] px-3.5 py-2 text-[14px] text-[color:var(--text)] bg-[color:var(--card)] border border-[color:var(--border)] rounded-[8px] transition-colors duration-150 hover:border-[color:var(--muted)] focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2 [color-scheme:light] dark:[color-scheme:dark]"
                                        >
                                            {framework.leadership_options.map((option) => (
                                                <option key={option} value={option}>
                                                    {option}
                                                </option>
                                            ))}
                                        </select>
                                        <InputError message={validationErrors.leadership_readiness} />
                                    </div>

                                    <div>
                                        <Label htmlFor="availability-hours" required>
                                            Weekly Availability
                                        </Label>
                                        <select
                                            id="availability-hours"
                                            value={availabilityHours}
                                            onChange={(e) => {
                                                setAvailabilityHours(e.target.value);
                                                setIsDirty(true);
                                                setSaveFeedback(null);
                                                setValidationErrors((prev) => {
                                                    if (!prev.availability_hours) return prev;
                                                    const next = { ...prev };
                                                    delete next.availability_hours;
                                                    return next;
                                                });
                                            }}
                                            className="w-full min-h-[44px] px-3.5 py-2 text-[14px] text-[color:var(--text)] bg-[color:var(--card)] border border-[color:var(--border)] rounded-[8px] transition-colors duration-150 hover:border-[color:var(--muted)] focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2 [color-scheme:light] dark:[color-scheme:dark]"
                                        >
                                            {framework.availability_options.map((option) => (
                                                <option key={option} value={option}>
                                                    {option}
                                                </option>
                                            ))}
                                        </select>
                                        <InputError message={validationErrors.availability_hours} />
                                    </div>
                                </div>
                            </div>
                        </Card>

                        {/* Section 3: Certifications & Experience Deliberation */}
                        <Card padding="none">
                            <div className="px-4 sm:px-5 py-4 border-b border-[color:var(--border)]">
                                <h2 className="text-[18px] font-semibold text-[color:var(--text)] leading-snug">
                                    Certifications & Experience Deliberation
                                </h2>
                                <p className="text-[13px] text-[color:var(--muted)] mt-1 max-w-[70ch]">
                                    List relevant trainings or certificates and explain the previous committee work or roles that show your readiness.
                                </p>
                            </div>

                            <div className="p-4 sm:p-5 space-y-5">
                                {cvCertifications.length > 0 && (
                                    <div className="p-3.5 rounded-[8px] bg-[color:var(--soft-surface)] border border-[color:var(--border)] space-y-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-[13px] font-semibold text-[color:var(--text)]">
                                                Certifications Detected from CV
                                            </span>
                                            <Badge variant="success">From CV</Badge>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {cvCertifications.map((cert) => (
                                                <span
                                                    key={cert}
                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-[12px] font-medium bg-[color:var(--card)] border border-[color:var(--border)] text-[color:var(--text)]"
                                                >
                                                    <Award className="w-3.5 h-3.5 text-[color:var(--status-success-text)] shrink-0 stroke-[2px]" />
                                                    <span>{cert}</span>
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <Label htmlFor="certification-input">
                                        Additional Trainings & Certificates
                                    </Label>
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <Input
                                            id="certification-input"
                                            type="text"
                                            value={certInput}
                                            maxLength={MAX_CERTIFICATION_LENGTH}
                                            hasError={Boolean(
                                                certInputError || validationErrors.certifications_list
                                            )}
                                            onChange={(e) => {
                                                setCertInput(e.target.value);
                                                if (certInputError) setCertInputError(null);
                                            }}
                                            onKeyDown={handleCertInputKeyDown}
                                            placeholder="e.g., ISO 9001 Internal Audit, React Workshop"
                                            className="min-h-[44px]"
                                        />
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            onClick={handleAddCertification}
                                            leftIcon={<Plus className="w-4 h-4 stroke-[2px]" />}
                                            className="min-h-[44px] shrink-0"
                                        >
                                            Add Certificate
                                        </Button>
                                    </div>

                                    <InputError
                                        message={
                                            certInputError || validationErrors.certifications_list
                                        }
                                    />

                                    {selfCertifications.length > 0 ? (
                                        <ul
                                            aria-label="Self-entered certifications"
                                            className="mt-3 flex flex-wrap gap-2"
                                        >
                                            {selfCertifications.map((cert) => (
                                                <li
                                                    key={cert}
                                                    className="inline-flex items-center gap-1.5 pl-3 pr-1 min-h-[44px] max-w-full rounded-[8px] bg-[color:var(--soft-surface)] border border-[color:var(--border)] text-[13px] font-medium text-[color:var(--text)]"
                                                >
                                                    <span className="truncate">{cert}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            handleRemoveCertification(cert)
                                                        }
                                                        aria-label={`Remove certification ${cert}`}
                                                        className="min-h-[44px] min-w-[44px] rounded-[6px] inline-flex items-center justify-center text-[color:var(--text)]/75 hover:text-[color:var(--text)] hover:bg-[color:var(--card)] transition-colors cursor-pointer focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2"
                                                    >
                                                        <X className="w-3.5 h-3.5 stroke-[2px]" />
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="mt-2 text-[12px] text-[color:var(--muted)]">
                                            No additional certificates added yet. Press Enter or click Add Certificate after typing each credential.
                                        </p>
                                    )}
                                </div>

                                <div className="pt-4 border-t border-[color:var(--border)]">
                                    <Label htmlFor="deliberation-notes">
                                        Experience Deliberation Statement
                                    </Label>
                                    <p
                                        id="deliberation-notes-prompt"
                                        className="text-[13px] text-[color:var(--muted)] mb-2 max-w-[70ch]"
                                    >
                                        What specific tasks do you deliver best, and what previous roles prove your readiness?
                                    </p>
                                    <textarea
                                        id="deliberation-notes"
                                        rows={4}
                                        maxLength={MAX_DELIBERATION_NOTES}
                                        aria-describedby="deliberation-notes-prompt deliberation-notes-count"
                                        value={deliberationNotes}
                                        onChange={(e) => {
                                            setDeliberationNotes(e.target.value);
                                            setIsDirty(true);
                                            setSaveFeedback(null);
                                            setValidationErrors((prev) => {
                                                if (!prev.deliberation_notes) return prev;
                                                const next = { ...prev };
                                                delete next.deliberation_notes;
                                                return next;
                                            });
                                        }}
                                        placeholder="Describe concrete outputs, committee assignments, technical systems, or documentation binders you have delivered..."
                                        className={`w-full px-3.5 py-2.5 text-[14px] text-[color:var(--text)] bg-[color:var(--card)] rounded-[8px] border transition-colors duration-150 placeholder:text-[color:var(--muted)] focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2 ${
                                            validationErrors.deliberation_notes
                                                ? 'border-[color:var(--primary)]'
                                                : 'border-[color:var(--border)] hover:border-[color:var(--muted)]'
                                        }`}
                                    />
                                    <div className="mt-1.5 flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <InputError
                                                message={validationErrors.deliberation_notes}
                                            />
                                        </div>
                                        <span
                                            id="deliberation-notes-count"
                                            className="text-[12px] text-[color:var(--muted)] tabular-nums shrink-0"
                                        >
                                            {deliberationNotes.length}/{MAX_DELIBERATION_NOTES}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Form Footer & Live Status Feedback */}
                            <div className="px-4 sm:px-5 py-4 bg-[color:var(--soft-surface)] border-t border-[color:var(--border)] rounded-b-[12px] space-y-3">
                                <div aria-live="polite">
                                    {saveFeedback && (
                                        <Alert
                                            variant={saveFeedback.variant}
                                            onClose={() => setSaveFeedback(null)}
                                        >
                                            {saveFeedback.message}
                                        </Alert>
                                    )}
                                </div>

                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <p className="text-[13px] text-[color:var(--text)]/80">
                                        {isDirty
                                            ? 'Unsaved edits are reflected in the Live Fit Preview.'
                                            : profile.assessment_completed_at
                                              ? `Saved on ${formatAssessmentDate(profile.assessment_completed_at)}`
                                              : 'Save your answers so committee chairs can evaluate your task fit.'}
                                    </p>

                                    <Button
                                        type="submit"
                                        variant="primary"
                                        size="lg"
                                        isLoading={isSaving}
                                        leftIcon={<Save className="w-4 h-4 stroke-[2px]" />}
                                        className="min-h-[44px] w-full sm:w-auto shrink-0"
                                    >
                                        {isSaving ? 'Saving Profile...' : 'Save Eligibility Profile'}
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    </form>

                    {/* ── Right Column (1/3): Optional CV OCR Upload + Live Fit Preview ── */}
                    <div className="lg:col-span-4 min-w-0 space-y-6">
                        {/* Card 1: Optional CV / Resume OCR Scanner */}
                        <Card padding="none">
                            <div className="px-4 sm:px-5 py-4 border-b border-[color:var(--border)]">
                                <h2 className="text-[18px] font-semibold text-[color:var(--text)] leading-snug">
                                    Optional CV / Resume OCR
                                </h2>
                                <p className="text-[13px] text-[color:var(--muted)] mt-1">
                                    Your questionnaire alone qualifies you for matching. Attach a CV anytime to extract documented skills and certificates.
                                </p>
                            </div>

                            <div className="p-4 sm:p-5 space-y-4">
                                <div className="p-3.5 rounded-[8px] bg-[color:var(--soft-surface)] border border-[color:var(--border)] space-y-2.5">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <span className="block text-[12px] font-medium text-[color:var(--text)]/75">
                                                Attached Document
                                            </span>
                                            <span className="block text-[13px] font-semibold text-[color:var(--text)] truncate mt-0.5">
                                                {profile.has_resume && profile.original_name
                                                    ? profile.original_name
                                                    : 'No CV attached yet'}
                                            </span>
                                        </div>
                                        <Badge variant={profile.has_resume ? 'success' : 'neutral'}>
                                            {profile.has_resume ? 'Scanned' : 'Optional'}
                                        </Badge>
                                    </div>

                                    {profile.experience_summary && (
                                        <p className="text-[12px] text-[color:var(--text)]/80 leading-relaxed">
                                            {profile.experience_summary}
                                        </p>
                                    )}

                                    {profile.extracted_skills.length > 0 && (
                                        <div className="pt-1">
                                            <span className="block text-[12px] font-medium text-[color:var(--text)]/75 mb-1.5">
                                                Merged Skills ({profile.extracted_skills.length})
                                            </span>
                                            <div className="flex flex-wrap gap-1.5">
                                                {profile.extracted_skills.slice(0, 10).map((skill) => (
                                                    <span
                                                        key={skill}
                                                        className="px-2 py-0.5 rounded-[6px] text-[12px] font-medium bg-[color:var(--card)] border border-[color:var(--border)] text-[color:var(--text)]"
                                                    >
                                                        {skill}
                                                    </span>
                                                ))}
                                                {profile.extracted_skills.length > 10 && (
                                                    <span className="px-2 py-0.5 rounded-[6px] text-[12px] font-medium text-[color:var(--text)]/75 tabular-nums">
                                                        +{profile.extracted_skills.length - 10} more
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <form onSubmit={handleCvUpload} className="space-y-3">
                                    <div>
                                        <Label htmlFor="cv-upload-input">
                                            Select CV or Resume File
                                        </Label>
                                        <input
                                            ref={cvFileInputRef}
                                            id="cv-upload-input"
                                            type="file"
                                            accept=".pdf,.png,.jpg,.jpeg,.docx,.txt"
                                            onChange={handleFileSelect}
                                            className="w-full min-h-[44px] text-[13px] text-[color:var(--text)] bg-[color:var(--card)] border border-[color:var(--border)] rounded-[8px] p-1.5 cursor-pointer file:mr-3 file:py-1.5 file:px-3 file:rounded-[6px] file:border file:border-[color:var(--border)] file:text-[12px] file:font-semibold file:bg-[color:var(--soft-surface)] file:text-[color:var(--text)] hover:file:border-[color:var(--muted)] focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2"
                                        />
                                        <p className="mt-1.5 text-[12px] text-[color:var(--muted)]">
                                            PDF, PNG, JPG, DOCX, or TXT up to 10 MB.
                                        </p>
                                    </div>

                                    {selectedCvFile && (
                                        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-[8px] bg-[color:var(--soft-surface)] border border-[color:var(--border)] text-[12px] text-[color:var(--text)]">
                                            <span className="truncate font-medium">
                                                {selectedCvFile.name}
                                            </span>
                                            <span className="tabular-nums text-[color:var(--text)]/75 shrink-0">
                                                {formatFileSize(selectedCvFile.size)}
                                            </span>
                                        </div>
                                    )}

                                    <div aria-live="polite">
                                        {cvFeedback && (
                                            <Alert
                                                variant={cvFeedback.variant}
                                                onClose={() => setCvFeedback(null)}
                                            >
                                                {cvFeedback.message}
                                            </Alert>
                                        )}
                                    </div>

                                    <Button
                                        type="submit"
                                        variant="secondary"
                                        isLoading={isUploadingCv}
                                        disabled={!selectedCvFile || isUploadingCv}
                                        leftIcon={<UploadCloud className="w-4 h-4 stroke-[2px]" />}
                                        className="w-full min-h-[44px]"
                                    >
                                        {isUploadingCv
                                            ? 'Scanning Document...'
                                            : profile.has_resume
                                              ? 'Replace & Scan CV'
                                              : 'Upload & Scan CV'}
                                    </Button>
                                </form>
                            </div>
                        </Card>

                        {/* Card 2: Live Task Deliberation Preview */}
                        <Card padding="none">
                            <div className="px-4 sm:px-5 py-4 border-b border-[color:var(--border)]">
                                <h2 className="text-[18px] font-semibold text-[color:var(--text)] leading-snug">
                                    Live Fit Preview (Based on current answers)
                                </h2>
                                <p className="text-[13px] text-[color:var(--muted)] mt-1">
                                    Estimated task alignment using your active questionnaire selections
                                    {profile.has_resume ? ' and scanned CV.' : '.'}
                                </p>
                            </div>

                            <div className="divide-y divide-[color:var(--border)]">
                                {previewItems.map((item) => (
                                    <div key={item.task.title} className="p-4 sm:px-5 space-y-2">
                                        <div className="flex items-start justify-between gap-2.5">
                                            <div className="min-w-0">
                                                <h3 className="text-[14px] font-semibold text-[color:var(--text)] leading-snug">
                                                    {item.task.title}
                                                </h3>
                                                <p className="text-[12px] text-[color:var(--muted)] mt-0.5">
                                                    {item.task.committee}
                                                </p>
                                            </div>
                                            <span className="px-2.5 py-1 rounded-[6px] bg-[color:var(--soft-surface)] border border-[color:var(--border)] text-[13px] font-bold text-[color:var(--text)] tabular-nums shrink-0">
                                                {item.score}%
                                            </span>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2">
                                            <Badge
                                                variant={
                                                    item.status === 'Highly Recommended'
                                                        ? 'success'
                                                        : 'primary'
                                                }
                                            >
                                                {item.status}
                                            </Badge>
                                            {!profile.has_resume && (
                                                <span className="text-[12px] font-medium text-[color:var(--muted)]">
                                                    Self-assessed (no CV attached)
                                                </span>
                                            )}
                                        </div>

                                        <p className="text-[12px] text-[color:var(--text)]/85 leading-relaxed">
                                            {item.reason}
                                        </p>

                                        {item.highlights.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                                                {item.highlights.map((highlight) => (
                                                    <span
                                                        key={highlight}
                                                        className="px-2 py-0.5 rounded-[6px] text-[12px] font-medium bg-[color:var(--soft-surface)] border border-[color:var(--border)] text-[color:var(--text)]"
                                                    >
                                                        {highlight}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {previewItems.length === 0 && (
                                    <div className="p-5 text-[13px] text-[color:var(--muted)]">
                                        No sample tasks available to preview right now.
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
