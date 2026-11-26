import React, { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import { SkillProfileData } from '@/types/skills';
import { SkillRatingCard } from '@/Components/Skills/SkillRatingCard';
import { SelfAssessmentNotice } from '@/Components/Skills/SelfAssessmentNotice';
import { Button } from '@/Components/Button';
import {
    Sparkles,
    ChevronRight,
    ChevronLeft,
    CheckCircle2,
    Clock,
    AlertCircle,
    Loader2,
} from 'lucide-react';

export default function SkillAssessmentOnboarding({
    categories = [],
    total_skills = 18,
    rated_count: initialRatedCount = 0,
    is_completed = false,
}: SkillProfileData) {
    const [currentCategoryIndex, setCurrentCategoryIndex] = useState(0);

    // Flatten user ratings into state dictionary
    const [ratingsMap, setRatingsMap] = useState<Record<number, number | null>>(() => {
        const initial: Record<number, number | null> = {};
        categories.forEach((cat) => {
            cat.skills.forEach((skill) => {
                initial[skill.id] = skill.user_rating;
            });
        });
        return initial;
    });

    const [isSaving, setIsSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const currentCategory = categories[currentCategoryIndex];
    const isFirstCategory = currentCategoryIndex === 0;
    const isLastCategory = currentCategoryIndex === categories.length - 1;

    // Calculate total currently rated skills in state
    const currentRatedCount = Object.values(ratingsMap).filter((val) => val !== null && val !== undefined).length;
    const progressPercentage = total_skills > 0 ? Math.round((currentRatedCount / total_skills) * 100) : 0;

    const handleRatingChange = (skillId: number, rating: number | null) => {
        setRatingsMap((prev) => ({
            ...prev,
            [skillId]: rating,
        }));
    };

    // Helper to extract ratings payload for current category or all
    const buildCategoryPayload = (categoryIdx: number) => {
        const cat = categories[categoryIdx];
        if (!cat) return [];
        return cat.skills.map((s) => ({
            skill_id: s.id,
            rating: ratingsMap[s.id] !== undefined ? ratingsMap[s.id] : null,
        }));
    };

    const buildAllRatingsPayload = () => {
        return Object.entries(ratingsMap).map(([skillId, rating]) => ({
            skill_id: Number(skillId),
            rating: rating !== undefined ? rating : null,
        }));
    };

    // Save and Advance
    const handleSaveAndContinue = async () => {
        setIsSaving(true);
        setErrorMessage(null);

        // On the final step, send all ratings to ensure any cross-category edits are persisted
        const payload = isLastCategory
            ? buildAllRatingsPayload()
            : buildCategoryPayload(currentCategoryIndex);

        try {
            const csrfToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content;
            const res = await fetch('/profile/skills', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': csrfToken || '',
                },
                body: JSON.stringify({ ratings: payload }),
            });

            const data = await res.json();
            if (res.ok && data.success) {
                if (!isLastCategory) {
                    setCurrentCategoryIndex((prev) => prev + 1);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                    // Completed last step! Redirect to dashboard
                    router.visit('/dashboard');
                }
            } else {
                setErrorMessage(data.message || 'Failed to save skills. Please check your selections.');
            }
        } catch (err: any) {
            setErrorMessage(err.message || 'Network error communicating with the server.');
        } finally {
            setIsSaving(false);
        }
    };

    // Complete Later Action
    const handleCompleteLater = async () => {
        setIsSaving(true);
        setErrorMessage(null);

        // Include any entered ratings from current session so they are not lost; if none rated, send empty array
        const hasAnyRated = Object.values(ratingsMap).some((r) => r !== null && r !== undefined);
        const payload = hasAnyRated ? buildAllRatingsPayload() : [];

        try {
            const csrfToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content;
            const res = await fetch('/onboarding/skills/complete-later', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': csrfToken || '',
                },
                body: JSON.stringify({ ratings: payload }),
            });

            const data = await res.json();
            if (res.ok && data.success) {
                router.visit(data.redirect_url || '/dashboard');
            } else {
                setErrorMessage(data.message || 'Unable to skip onboarding.');
            }
        } catch (err: any) {
            setErrorMessage(err.message || 'Error processing request.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-[color:var(--background)] text-[color:var(--text)] flex flex-col justify-between selection:bg-[color:var(--primary)] selection:text-white">
            <Head title="Skill Assessment Onboarding - ITASK" />

            {/* Header */}
            <header className="border-b border-[color:var(--border)] bg-[color:var(--card)] py-4 px-6 sticky top-0 z-20 backdrop-blur-md">
                <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-[color:var(--color-brand-action-orange)]/10 text-[color:var(--color-brand-action-orange)] flex items-center justify-center font-bold">
                            <Sparkles className="w-4 h-4" />
                        </div>
                        <div>
                            <h1 className="text-sm font-bold text-[color:var(--text)] leading-tight">
                                ITASK Skill Profiling
                            </h1>
                            <p className="text-[11px] text-[color:var(--muted)]">Initial Onboarding Assessment</p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleCompleteLater}
                        disabled={isSaving}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[color:var(--muted)] hover:text-[color:var(--text)] hover:bg-[color:var(--soft-surface)] rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                        title="Skip assessment and proceed to dashboard"
                    >
                        <Clock className="w-3.5 h-3.5" />
                        <span>Complete Later</span>
                    </button>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6 flex-1">
                {/* Progress Bar & Counter */}
                <div className="p-4 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] space-y-3">
                    <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-[color:var(--text)]">Overall Progress</span>
                            <span className="text-[11px] text-[color:var(--muted)]">
                                ({currentRatedCount} of {total_skills} skills rated)
                            </span>
                        </div>
                        <span className="font-mono font-bold text-[color:var(--primary)]">{progressPercentage}%</span>
                    </div>

                    <div className="w-full h-2 rounded-full bg-[color:var(--soft-surface)] overflow-hidden">
                        <div
                            className="h-full bg-[color:var(--color-brand-action-orange)] transition-all duration-300 rounded-full"
                            style={{ width: `${progressPercentage}%` }}
                        />
                    </div>

                    {/* Stepper Tabs */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                        {categories.map((cat, idx) => {
                            const isCurrent = idx === currentCategoryIndex;
                            const isDone = idx < currentCategoryIndex;
                            return (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => setCurrentCategoryIndex(idx)}
                                    className={`px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors border cursor-pointer ${
                                        isCurrent
                                            ? 'bg-[color:var(--soft-surface)] border-[color:var(--color-brand-action-orange)] font-semibold text-[color:var(--text)]'
                                            : isDone
                                              ? 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5'
                                              : 'border-[color:var(--border)] text-[color:var(--muted)] hover:bg-[color:var(--soft-surface)]'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="truncate">Part {idx + 1}</span>
                                        {isDone && <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />}
                                    </div>
                                    <p className="text-[10px] truncate opacity-80">{cat.name}</p>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Notice */}
                <SelfAssessmentNotice />

                {/* Error Banner */}
                {errorMessage && (
                    <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{errorMessage}</span>
                    </div>
                )}

                {/* Active Category Header */}
                {currentCategory ? (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-[color:var(--border)] pb-2.5">
                            <div>
                                <span className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--primary)]">
                                    Category {String.fromCharCode(65 + currentCategoryIndex)}
                                </span>
                                <h2 className="text-lg font-bold text-[color:var(--text)]">
                                    {currentCategory.name}
                                </h2>
                            </div>
                            <span className="text-xs text-[color:var(--muted)]">
                                {currentCategory.skills.length} skills in this section
                            </span>
                        </div>

                        {/* Skill Cards */}
                        <div className="space-y-3">
                            {currentCategory.skills.map((skill) => (
                                <SkillRatingCard
                                    key={skill.id}
                                    skill={skill}
                                    currentRating={ratingsMap[skill.id]}
                                    onChange={handleRatingChange}
                                    disabled={isSaving}
                                />
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-12 text-xs text-[color:var(--muted)]">
                        No skill categories currently initialized in the database.
                    </div>
                )}
            </main>

            {/* Bottom Actions Bar */}
            <footer className="border-t border-[color:var(--border)] bg-[color:var(--card)] py-4 px-6 sticky bottom-0 z-20 backdrop-blur-md">
                <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
                    <div>
                        {!isFirstCategory && (
                            <button
                                type="button"
                                disabled={isSaving}
                                onClick={() => {
                                    setCurrentCategoryIndex((prev) => prev - 1);
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-[color:var(--border)] hover:bg-[color:var(--soft-surface)] transition-colors cursor-pointer disabled:opacity-50"
                            >
                                <ChevronLeft className="w-4 h-4" />
                                <span>Previous Part</span>
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={handleCompleteLater}
                            disabled={isSaving}
                            className="px-3.5 py-2 text-xs font-medium text-[color:var(--muted)] hover:text-[color:var(--text)] transition-colors cursor-pointer disabled:opacity-50"
                        >
                            Complete Later
                        </button>

                        <Button
                            type="button"
                            onClick={handleSaveAndContinue}
                            disabled={isSaving}
                            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[color:var(--color-brand-action-orange)] text-white hover:bg-orange-600 rounded-lg cursor-pointer transition-colors shadow-xs"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Saving...</span>
                                </>
                            ) : isLastCategory ? (
                                <>
                                    <span>Complete Assessment</span>
                                    <CheckCircle2 className="w-4 h-4 ml-1" />
                                </>
                            ) : (
                                <>
                                    <span>Save & Continue</span>
                                    <ChevronRight className="w-4 h-4 ml-1" />
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </footer>
        </div>
    );
}
