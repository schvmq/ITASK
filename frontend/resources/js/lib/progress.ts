/**
 * Dynamic Progress Bar Gradient Configuration based on completion:
 * - 10% – 30%: RED gradient (from-rose-500 to-red-600)
 * - 40% – 70%: YELLOW / Amber gradient (from-amber-400 to-yellow-500)
 * - 71% – 99%: Transition Green / Teal (from-emerald-400 to-teal-500)
 * - 100% or Complete: Solid vibrant Green gradient (from-emerald-500 to-green-600)
 */

export interface ProgressBarStyles {
    barGradient: string;
    shadow: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
    label: string;
}

export function getProgressBarGradient(
    progress: number,
    isCompleted: boolean = false
): ProgressBarStyles {
    const val = Math.round(Number(progress) || 0);

    if (isCompleted || val >= 100) {
        return {
            barGradient: 'bg-gradient-to-r from-emerald-500 via-emerald-600 to-green-600',
            shadow: 'shadow-[0_0_10px_rgba(34,197,94,0.45)]',
            badgeBg: 'bg-emerald-500/10',
            badgeText: 'text-emerald-600 dark:text-emerald-400',
            badgeBorder: 'border-emerald-500/20',
            label: 'Complete',
        };
    }

    if (val >= 71) {
        return {
            barGradient: 'bg-gradient-to-r from-emerald-400 via-teal-500 to-teal-600',
            shadow: 'shadow-[0_0_8px_rgba(20,184,166,0.4)]',
            badgeBg: 'bg-teal-500/10',
            badgeText: 'text-teal-600 dark:text-teal-400',
            badgeBorder: 'border-teal-500/20',
            label: `${val}%`,
        };
    }

    if (val >= 40) {
        // 40% - 70%: YELLOW / Amber
        return {
            barGradient: 'bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500',
            shadow: 'shadow-[0_0_8px_rgba(245,158,11,0.4)]',
            badgeBg: 'bg-amber-500/10',
            badgeText: 'text-amber-600 dark:text-amber-400',
            badgeBorder: 'border-amber-500/20',
            label: `${val}%`,
        };
    }

    // 10% - 39% (and initial progress): RED
    return {
        barGradient: 'bg-gradient-to-r from-rose-500 via-red-500 to-red-600',
        shadow: 'shadow-[0_0_8px_rgba(239,68,68,0.4)]',
        badgeBg: 'bg-rose-500/10',
        badgeText: 'text-rose-600 dark:text-rose-400',
        badgeBorder: 'border-rose-500/20',
        label: `${val}%`,
    };
}
