import React from 'react';
import { SkillItem, PROFICIENCY_SCALE } from '@/types/skills';
import { Check, X } from 'lucide-react';

interface SkillRatingCardProps {
    skill: SkillItem;
    currentRating: number | null;
    onChange: (skillId: number, rating: number | null) => void;
    disabled?: boolean;
}

export const SkillRatingCard: React.FC<SkillRatingCardProps> = ({
    skill,
    currentRating,
    onChange,
    disabled = false,
}) => {
    const isUnrated = currentRating === null || currentRating === undefined;
    const activeLevel = isUnrated ? PROFICIENCY_SCALE.unrated : PROFICIENCY_SCALE[String(currentRating)];

    const ratingOptions = [
        { value: 0, label: '0', title: 'No experience' },
        { value: 1, label: '1', title: 'With guidance' },
        { value: 2, label: '2', title: 'Independent' },
        { value: 3, label: '3', title: 'Advanced' },
        { value: 4, label: '4', title: 'Highly proficient' },
    ];

    return (
        <div className="p-4 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] transition-shadow hover:shadow-xs space-y-3">
            <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded-md bg-[color:var(--soft-surface)] text-[color:var(--muted)] border border-[color:var(--border)]">
                            #{skill.display_order}
                        </span>
                        <h4 className="text-sm font-semibold text-[color:var(--text)]">{skill.name}</h4>
                    </div>
                    <p className="text-xs text-[color:var(--muted)] italic leading-relaxed">
                        &ldquo;{skill.statement}&rdquo;
                    </p>
                </div>

                {/* Rating Status Badge */}
                <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border shrink-0 ${
                        isUnrated
                            ? 'bg-[color:var(--soft-surface)] text-[color:var(--muted)] border-[color:var(--border)]'
                            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-semibold'
                    }`}
                >
                    {!isUnrated && <Check className="w-3 h-3" aria-hidden="true" />}
                    {activeLevel.label}
                </span>
            </div>

            {/* Interactive Rating Scale */}
            <div className="space-y-1.5">
                <div
                    className="flex flex-wrap items-center gap-1.5"
                    role="radiogroup"
                    aria-label={`Proficiency rating for ${skill.name}`}
                >
                    {ratingOptions.map((opt) => {
                        const isSelected = currentRating === opt.value;
                        return (
                            <button
                                key={opt.value}
                                type="button"
                                role="radio"
                                aria-checked={isSelected}
                                disabled={disabled}
                                onClick={() => onChange(skill.id, opt.value)}
                                title={opt.title}
                                className={`inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500/40 disabled:opacity-50 disabled:cursor-not-allowed ${
                                    isSelected
                                        ? 'bg-[color:var(--color-brand-action-orange)] text-white border-[color:var(--color-brand-action-orange)] shadow-xs scale-[1.02]'
                                        : 'bg-[color:var(--card)] text-[color:var(--text)] border-[color:var(--border)] hover:bg-[color:var(--soft-surface)]'
                                }`}
                            >
                                {isSelected && (
                                    <Check className="w-3 h-3 mr-1 stroke-[2.5] shrink-0" aria-hidden="true" />
                                )}
                                <span className="mr-1">{opt.label}</span>
                                <span className="text-[10px] font-normal opacity-90 hidden sm:inline">
                                    {opt.title}
                                </span>
                            </button>
                        );
                    })}

                    {/* Clear to Unrated Option */}
                    {!isUnrated && (
                        <button
                            type="button"
                            disabled={disabled}
                            onClick={() => onChange(skill.id, null)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg text-[color:var(--muted)] hover:text-rose-500 hover:bg-rose-500/10 border border-transparent transition-colors cursor-pointer disabled:opacity-50"
                            title="Clear rating back to Unrated"
                        >
                            <X className="w-3 h-3" />
                            <span className="text-[11px]">Clear</span>
                        </button>
                    )}
                </div>

                {/* Behavioral Level Description */}
                <p className="text-[11px] text-[color:var(--muted)]">
                    <span className="font-medium text-[color:var(--text)]">{activeLevel.label}:</span>{' '}
                    {activeLevel.description}
                </p>
            </div>
        </div>
    );
};
