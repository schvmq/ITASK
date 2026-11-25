import React from 'react';
import { Info } from 'lucide-react';

interface SelfAssessmentNoticeProps {
    className?: string;
}

export const SelfAssessmentNotice: React.FC<SelfAssessmentNoticeProps> = ({ className = '' }) => {
    return (
        <div
            className={`p-4 rounded-xl border border-[color:var(--border)] bg-[color:var(--soft-surface)] flex items-start gap-3 text-xs leading-relaxed text-[color:var(--muted)] ${className}`}
            role="note"
            aria-label="Self-assessment notice"
        >
            <Info className="w-4 h-4 text-[color:var(--primary)] shrink-0 mt-0.5" aria-hidden="true" />
            <div>
                <p className="font-medium text-[color:var(--text)] mb-0.5">Self-Reported Assessment Notice</p>
                <p>
                    Your skill ratings are self-reported and are not independently verified. They are used to support
                    authorized task assignment decisions. You may update your ratings at any time.
                </p>
            </div>
        </div>
    );
};
