import React, { useRef } from 'react';
import { useForm } from '@inertiajs/react';
import { X, FolderOpen, Upload, FileText } from 'lucide-react';
import { Button } from '@/Components/Button';

interface CreateProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function CreateProjectModal({ isOpen, onClose }: CreateProjectModalProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { data, setData, post, processing, errors, reset, clearErrors } = useForm<{
        title: string;
        description: string;
        start_date: string;
        end_date: string;
        approval_document: File | null;
    }>({
        title: '',
        description: '',
        start_date: '',
        end_date: '',
        approval_document: null,
    });

    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] ?? null;
        setData('approval_document', file);
    };

    const handleClose = () => {
        if (processing) return;
        reset();
        clearErrors();
        if (fileInputRef.current) fileInputRef.current.value = '';
        onClose();
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/projects', {
            forceFormData: true,
            onSuccess: () => {
                handleClose();
            },
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div
                className="w-full max-w-lg bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-[var(--tint-yellow)] flex items-center justify-center text-[#8A5A00] dark:text-[#FFBB00]">
                            <FolderOpen className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-[var(--ink)]">
                                Create New Project
                            </h3>
                            <p className="text-xs text-[var(--muted)]">
                                Setup committees, tasks, and deadlines
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="p-1 rounded-lg text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--tint-neutral)]"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Title */}
                    <div>
                        <label className="block text-xs font-bold text-[var(--ink)] mb-1">
                            Project Title <span className="text-[#EC7505]">*</span>
                        </label>
                        <input
                            type="text"
                            required
                            value={data.title}
                            onChange={(e) => setData('title', e.target.value)}
                            placeholder="e.g. Capstone Research Project"
                            className="w-full px-3.5 py-2 text-sm rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--ink)] placeholder-[var(--muted)] outline-none focus:border-[#EC7505]"
                        />
                        {errors.title && (
                            <p className="text-xs text-rose-500 mt-1">{errors.title}</p>
                        )}
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-xs font-bold text-[var(--ink)] mb-1">
                            Description
                        </label>
                        <textarea
                            rows={3}
                            value={data.description}
                            onChange={(e) => setData('description', e.target.value)}
                            placeholder="Summarize project scope and primary deliverables..."
                            className="w-full px-3.5 py-2 text-sm rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--ink)] placeholder-[var(--muted)] outline-none focus:border-[#EC7505]"
                        />
                        {errors.description && (
                            <p className="text-xs text-rose-500 mt-1">{errors.description}</p>
                        )}
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-[var(--ink)] mb-1">
                                Start Date
                            </label>
                            <input
                                type="date"
                                value={data.start_date}
                                onChange={(e) => setData('start_date', e.target.value)}
                                className="w-full px-3 py-2 text-xs rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--ink)] outline-none focus:border-[#EC7505]"
                            />
                            {errors.start_date && (
                                <p className="text-xs text-rose-500 mt-1">{errors.start_date}</p>
                            )}
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-[var(--ink)] mb-1">
                                End Date / Deadline
                            </label>
                            <input
                                type="date"
                                value={data.end_date}
                                onChange={(e) => setData('end_date', e.target.value)}
                                className="w-full px-3 py-2 text-xs rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--ink)] outline-none focus:border-[#EC7505]"
                            />
                            {errors.end_date && (
                                <p className="text-xs text-rose-500 mt-1">{errors.end_date}</p>
                            )}
                        </div>
                    </div>

                    {/* Approval Document (optional) */}
                    <div>
                        <label className="block text-xs font-bold text-[var(--ink)] mb-1">
                            Charter / Approval Document (Optional)
                        </label>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,.doc,.docx"
                            onChange={handleFileChange}
                            className="w-full text-xs text-[var(--muted)] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[var(--tint-neutral)] file:text-[var(--ink)] hover:file:opacity-80 cursor-pointer"
                        />
                        {errors.approval_document && (
                            <p className="text-xs text-rose-500 mt-1">{errors.approval_document}</p>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="pt-3 flex items-center justify-end gap-3 border-t border-[var(--border)]">
                        <Button
                            type="button"
                            variant="secondary"
                            size="md"
                            onClick={handleClose}
                            disabled={processing}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            size="md"
                            isLoading={processing}
                        >
                            Create project
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
