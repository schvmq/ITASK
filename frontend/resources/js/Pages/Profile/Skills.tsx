import React, { useState, useMemo } from 'react';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import { AppLayout } from '@/Layouts/AppLayout';
import { SkillProfileData } from '@/types/skills';
import { SkillRatingCard } from '@/Components/Skills/SkillRatingCard';
import { SelfAssessmentNotice } from '@/Components/Skills/SelfAssessmentNotice';
import { Button } from '@/Components/Button';
import {
    Sparkles,
    CheckCircle2,
    Save,
    AlertCircle,
    Loader2,
    RefreshCw,
} from 'lucide-react';

export default function ProfileSkillsPage({
    categories = [],
    total_skills = 18,
    rated_count: initialRatedCount = 0,
    is_completed: initialIsCompleted = false,
}: SkillProfileData) {
    // Local state for current ratings
    const [ratingsMap, setRatingsMap] = useState<Record<number, number | null>>(() => {
        const initial: Record<number, number | null> = {};
        categories.forEach((cat) => {
            cat.skills.forEach((skill) => {
                initial[skill.id] = skill.user_rating;
            });
        });
        return initial;
    });

    // Track original baseline to detect unsaved changes
    const [originalRatings, setOriginalRatings] = useState<Record<number, number | null>>(() => {
        const initial: Record<number, number | null> = {};
        categories.forEach((cat) => {
            cat.skills.forEach((skill) => {
                initial[skill.id] = skill.user_rating;
            });
        });
        return initial;
    });

    const [isSaving, setIsSaving] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Compute unsaved changes count
    const hasUnsavedChanges = useMemo(() => {
        return Object.keys(ratingsMap).some((skillIdStr) => {
            const skillId = Number(skillIdStr);
            return ratingsMap[skillId] !== originalRatings[skillId];
        });
    }, [ratingsMap, originalRatings]);

    // Current rated count
    const currentRatedCount = Object.values(ratingsMap).filter((val) => val !== null && val !== undefined).length;
    const isCompleted = total_skills > 0 && currentRatedCount >= total_skills;
    const progressPercentage = total_skills > 0 ? Math.round((currentRatedCount / total_skills) * 100) : 0;

    const handleRatingChange = (skillId: number, rating: number | null) => {
        setRatingsMap((prev) => ({
            ...prev,
            [skillId]: rating,
        }));
        setStatusMessage(null);
        setErrorMessage(null);
    };

    const handleSaveChanges = async () => {
        setIsSaving(true);
        setStatusMessage(null);
        setErrorMessage(null);

        // Build payload of only changed ratings or all ratings
        const payload = Object.entries(ratingsMap).map(([skillId, rating]) => ({
            skill_id: Number(skillId),
            rating: rating !== undefined ? rating : null,
        }));

        try {
            const res = await axios.post('/profile/skills', { ratings: payload });
            if (res.data && res.data.success) {
                setStatusMessage('Your skill profile has been updated successfully.');
                setOriginalRatings({ ...ratingsMap });
            } else {
                setErrorMessage(res.data?.message || 'Failed to save changes. Please check your selections.');
            }
        } catch (err: any) {
            setErrorMessage(
                err.response?.data?.message ||
                (err.response?.data?.errors ? Object.values(err.response.data.errors).flat().join(' ') : null) ||
                err.message ||
                'Network error occurred while saving.'
            );
        } finally {
            setIsSaving(false);
        }
    };

    const handleResetChanges = () => {
        setRatingsMap({ ...originalRatings });
        setStatusMessage(null);
        setErrorMessage(null);
    };

    return (
        <AppLayout
            title="My Skill Profile"
            subtitle="Manage your standardized self-assessment ratings across institutional activities."
            breadcrumbs={[{ label: 'My Skill Profile' }]}
        >
            <Head title="My Skill Profile - ITASK" />

            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
                {/* Header Banner */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[color:var(--border)]">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-[color:var(--primary)]/10 text-[color:var(--primary)] flex items-center justify-center font-bold">
                                <Sparkles className="w-4 h-4" />
                            </div>
                            <h1 className="text-xl font-bold text-[color:var(--text)]">My Skill Profile</h1>
                        </div>
                        <p className="text-xs text-[color:var(--muted)]">
                            Manage your standardized self-assessment ratings across institutional activities.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        {hasUnsavedChanges && (
                            <button
                                type="button"
                                onClick={handleResetChanges}
                                disabled={isSaving}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] text-xs font-medium text-[color:var(--muted)] hover:text-[color:var(--text)] hover:bg-[color:var(--soft-surface)] rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                            >
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>Reset</span>
                            </button>
                        )}
                        <Button
                            type="button"
                            onClick={handleSaveChanges}
                            disabled={!hasUnsavedChanges || isSaving}
                            className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[44px] text-xs font-semibold bg-[color:var(--primary)] text-white hover:opacity-90 rounded-lg cursor-pointer transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Saving...</span>
                                </>
                            ) : (
                                <>
                                    <Save className="w-3.5 h-3.5" />
                                    <span>Save Changes</span>
                                </>
                            )}
                        </Button>
                    </div>
                </div>

                {/* Progress & Completion Card */}
                <div className="p-4 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] space-y-3">
                    <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-[color:var(--text)]">Assessment Progress</span>
                            <span className="text-[11px] text-[color:var(--muted)]">
                                ({currentRatedCount} of {total_skills} skills rated)
                            </span>
                        </div>

                        <div className="flex items-center gap-2">
                            {isCompleted ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Assessment Complete
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[color:var(--soft-surface)] text-[color:var(--muted)] border border-[color:var(--border)]">
                                    Incomplete ({total_skills - currentRatedCount} unrated)
                                </span>
                            )}
                            <span className="font-mono font-bold text-[color:var(--primary)]">{progressPercentage}%</span>
                        </div>
                    </div>

                    <div className="w-full h-2 rounded-full bg-[color:var(--soft-surface)] overflow-hidden">
                        <div
                            className="h-full bg-[color:var(--primary)] transition-all duration-300 rounded-full"
                            style={{ width: `${progressPercentage}%` }}
                        />
                    </div>
                </div>

                {/* Feedback Alerts */}
                {statusMessage && (
                    <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>{statusMessage}</span>
                    </div>
                )}

                {errorMessage && (
                    <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{errorMessage}</span>
                    </div>
                )}

                {/* Self-Assessment Notice */}
                <SelfAssessmentNotice />

                {/* Skill Categories & Cards */}
                <div className="space-y-8">
                    {categories.map((category, catIdx) => (
                        <section key={category.id} className="space-y-3.5">
                            <div className="flex items-center justify-between border-b border-[color:var(--border)] pb-2">
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--primary)]">
                                        Category {String.fromCharCode(65 + catIdx)}
                                    </span>
                                    <h2 className="text-base font-bold text-[color:var(--text)]">
                                        {category.name}
                                    </h2>
                                </div>
                                <span className="text-xs text-[color:var(--muted)]">
                                    {category.skills.length} skills
                                </span>
                            </div>

                            <div className="space-y-3">
                                {category.skills.map((skill) => (
                                    <SkillRatingCard
                                        key={skill.id}
                                        skill={skill}
                                        currentRating={ratingsMap[skill.id]}
                                        onChange={handleRatingChange}
                                        disabled={isSaving}
                                    />
                                ))}
                            </div>
                        </section>
                    ))}
                </div>

                {/* Sticky Unsaved Changes Bar */}
                {hasUnsavedChanges && (
                    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 max-w-md w-full px-4">
                        <div className="p-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] shadow-lg flex items-center justify-between gap-3 text-xs">
                            <span className="font-medium text-[color:var(--text)] flex items-center gap-1.5">
                                <Sparkles className="w-4 h-4 text-[color:var(--primary)] animate-pulse" />
                                You have unsaved rating changes.
                            </span>
                            <Button
                                type="button"
                                onClick={handleSaveChanges}
                                disabled={isSaving}
                                className="px-3.5 py-1.5 min-h-[44px] text-xs font-semibold bg-[color:var(--primary)] text-white hover:opacity-90 rounded-lg cursor-pointer"
                            >
                                {isSaving ? 'Saving...' : 'Save Now'}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
