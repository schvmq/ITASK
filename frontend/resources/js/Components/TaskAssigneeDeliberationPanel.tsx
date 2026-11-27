import React, { useState } from 'react';
import axios from 'axios';
import { Sparkles, UserCheck, Check, AlertCircle, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/Components/Badge';

export interface DeliberationRecommendation {
    user_id: number;
    name: string;
    email: string;
    score: number;
    fit_level: 'Highly Recommended' | 'Eligible' | 'Needs Verification' | 'Not Assessed' | string;
    reason: string;
    has_cv: boolean;
    has_questionnaire: boolean;
    top_strengths?: string[];
    availability?: string | null;
    matched_skills?: string[];
}

export interface TaskAssigneeDeliberationPanelProps {
    projectId: string | number;
    committeeId?: string | number | null;
    taskTitle: string;
    taskDescription?: string;
    selectedUserId?: string | number | null;
    onSelectAssignee: (userId: string) => void;
    className?: string;
}

export const TaskAssigneeDeliberationPanel: React.FC<TaskAssigneeDeliberationPanelProps> = ({
    projectId,
    committeeId,
    taskTitle,
    taskDescription,
    selectedUserId,
    onSelectAssignee,
    className = '',
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [hasDeliberated, setHasDeliberated] = useState(false);
    const [recommendations, setRecommendations] = useState<DeliberationRecommendation[]>([]);
    const [isOllamaActive, setIsOllamaActive] = useState<boolean | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isExpanded, setIsExpanded] = useState(true);

    const hasTitle = Boolean(taskTitle && taskTitle.trim().length > 0);

    const handleDeliberate = async () => {
        if (!hasTitle || isLoading) return;

        setIsLoading(true);
        setErrorMessage(null);

        try {
            const payload: Record<string, any> = {
                task_title: taskTitle.trim(),
                task_description: taskDescription ? taskDescription.trim() : null,
            };

            if (committeeId) {
                payload.committee_id = Number(committeeId);
            }

            const response = await axios.post(
                `/projects/${projectId}/tasks/recommend-assignees`,
                payload
            );

            if (response.data && response.data.success) {
                setRecommendations(response.data.recommendations || []);
                setIsOllamaActive(response.data.ollama_active ?? false);
                setHasDeliberated(true);
                setIsExpanded(true);
            } else {
                setErrorMessage(response.data?.message || 'Could not deliberate assignees.');
            }
        } catch (err: any) {
            const msg =
                err.response?.data?.message ||
                (err.response?.data?.errors
                    ? Object.values(err.response.data.errors).flat().join(' ')
                    : null) ||
                'Failed to deliberate assignees. Please check your connection or permissions.';
            setErrorMessage(msg);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <section
            aria-label="Assignee Deliberation & Fit Analysis"
            className={`rounded-[10px] border border-[color:var(--border)] bg-[color:var(--card)] p-3 sm:p-3.5 space-y-3 ${className}`}
        >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-[8px] bg-[color:var(--primary)]/10 text-[color:var(--primary)] flex items-center justify-center shrink-0">
                        <Sparkles className="w-4 h-4 stroke-[2.2]" />
                    </div>
                    <div className="min-w-0">
                        <h4 className="text-[13px] font-semibold text-[color:var(--text)] flex items-center gap-2 flex-wrap leading-tight">
                            <span>Deliberate Best Assignee</span>
                            {isOllamaActive !== null && (
                                <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full bg-[color:var(--soft-surface)] border border-[color:var(--border)] text-[color:var(--muted)]">
                                    {isOllamaActive ? '● Ollama Active' : '● Heuristic Active'}
                                </span>
                            )}
                        </h4>
                        <p className="text-[12px] text-[color:var(--muted)] truncate">
                            Ranks candidates based on questionnaire strengths, availability & CV credentials.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                    <button
                        type="button"
                        onClick={handleDeliberate}
                        disabled={!hasTitle || isLoading}
                        aria-busy={isLoading}
                        className="min-h-[44px] px-3.5 py-2 rounded-[8px] text-[12px] font-semibold bg-[color:var(--primary)] text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all inline-flex items-center gap-1.5 cursor-pointer focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2"
                    >
                        <Sparkles className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                        <span>{isLoading ? 'Deliberating...' : 'Deliberate Fit'}</span>
                    </button>
                    {hasDeliberated && recommendations.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setIsExpanded(!isExpanded)}
                            aria-expanded={isExpanded}
                            aria-label={isExpanded ? 'Collapse recommendations' : 'Expand recommendations'}
                            className="min-h-[44px] min-w-[44px] rounded-[8px] border border-[color:var(--border)] bg-[color:var(--soft-surface)] hover:bg-[color:var(--card)] text-[color:var(--text)] inline-flex items-center justify-center cursor-pointer focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2"
                        >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                    )}
                </div>
            </div>

            {!hasTitle && !hasDeliberated && (
                <p className="text-[11px] text-[color:var(--muted)] italic">
                    Enter a task title above to deliberate candidate suitability.
                </p>
            )}

            {errorMessage && (
                <div
                    role="alert"
                    className="p-2.5 rounded-[8px] bg-[color:var(--status-danger-bg)] border border-[color:var(--status-danger-border)] text-[color:var(--status-danger-text)] text-[12px] flex items-start gap-2"
                >
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                </div>
            )}

            {/* Deliberation Results */}
            {hasDeliberated && isExpanded && (
                <div className="pt-2 border-t border-[color:var(--border)] space-y-2">
                    {recommendations.length > 0 ? (
                        <div
                            role="list"
                            aria-label="Recommended Assignees"
                            className="space-y-2 max-h-60 overflow-y-auto pr-1"
                        >
                            {recommendations.map((rec) => {
                                const isSelected =
                                    selectedUserId !== undefined &&
                                    selectedUserId !== null &&
                                    String(selectedUserId) === String(rec.user_id);

                                return (
                                    <div
                                        key={rec.user_id}
                                        role="listitem"
                                        className={`p-2.5 rounded-[8px] border transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                                            isSelected
                                                ? 'bg-[color:var(--primary)]/10 border-[color:var(--primary)]/50'
                                                : 'bg-[color:var(--soft-surface)] border-[color:var(--border)] hover:border-[color:var(--primary)]/30'
                                        }`}
                                    >
                                        <div className="min-w-0 space-y-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-[13px] font-semibold text-[color:var(--text)]">
                                                    {rec.name}
                                                </span>
                                                <Badge
                                                    variant={
                                                        rec.score >= 85
                                                            ? 'success'
                                                            : rec.score >= 70
                                                            ? 'primary'
                                                            : 'secondary'
                                                    }
                                                    className="text-[11px] font-bold"
                                                >
                                                    {rec.score}% Match • {rec.fit_level}
                                                </Badge>
                                                {rec.has_questionnaire && (
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                                        <UserCheck className="w-3 h-3" />
                                                        Questionnaire
                                                    </span>
                                                )}
                                                {rec.has_cv && (
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                                                        <FileText className="w-3 h-3" />
                                                        CV
                                                    </span>
                                                )}
                                            </div>

                                            {rec.reason && (
                                                <p className="text-[12px] text-[color:var(--muted)] italic leading-tight">
                                                    "{rec.reason}"
                                                </p>
                                            )}

                                            <div className="flex items-center gap-2 flex-wrap text-[11px] text-[color:var(--muted)]">
                                                {rec.availability && (
                                                    <span>Availability: {rec.availability}</span>
                                                )}
                                                {rec.top_strengths && rec.top_strengths.length > 0 && (
                                                    <span className="truncate">
                                                        Top Strengths: {rec.top_strengths.join(', ')}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="self-end sm:self-center shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => onSelectAssignee(String(rec.user_id))}
                                                className={`min-h-[44px] px-3 py-1.5 rounded-[6px] text-[12px] font-semibold transition-all inline-flex items-center gap-1.5 cursor-pointer focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] ${
                                                    isSelected
                                                        ? 'bg-[color:var(--primary)] text-white shadow-xs'
                                                        : 'bg-[color:var(--card)] border border-[color:var(--border)] text-[color:var(--text)] hover:border-[color:var(--primary)] hover:text-[color:var(--primary)]'
                                                }`}
                                            >
                                                {isSelected ? (
                                                    <>
                                                        <Check className="w-3.5 h-3.5" />
                                                        <span>Assigned</span>
                                                    </>
                                                ) : (
                                                    <span>Assign</span>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-[12px] text-[color:var(--muted)] text-center py-2">
                            No eligible candidates found for this task scope.
                        </p>
                    )}
                </div>
            )}
        </section>
    );
};

export default TaskAssigneeDeliberationPanel;

