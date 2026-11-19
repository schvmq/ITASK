import React, { useState, useMemo } from 'react';
import { useForm, router, usePage } from '@inertiajs/react';
import { Modal } from '@/Components/Modal';
import { FormField } from '@/Components/FormField';
import { Label } from '@/Components/Label';
import { InputError } from '@/Components/InputError';
import { Button } from '@/Components/Button';

interface CreateCommitteeModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId?: string;
    projects?: Array<{ id: string; title: string }>;
}

export function CreateCommitteeModal({
    isOpen,
    onClose,
    projectId,
    projects = [],
}: CreateCommitteeModalProps) {
    const pageProps = usePage().props as any;
    const availableUsers: Array<{ id: number; name: string; email: string }> = pageProps?.available_users || [];
    const authUser = pageProps?.auth?.user;

    const [selectedProjectId, setSelectedProjectId] = useState<string>(projectId || (projects[0]?.id ?? ''));

    const { data, setData, post, processing, errors, reset } = useForm({
        name: '',
        description: '',
        user_id: '',
        co_chair_id: '',
    });

    const activeProjectId = projectId || selectedProjectId;

    const candidates = useMemo(() => {
        return availableUsers
            .filter((u) => u.id !== authUser?.id)
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [availableUsers, authUser]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeProjectId) {
            router.visit('/projects');
            onClose();
            return;
        }

        post(`/projects/${activeProjectId}/committees`, {
            preserveScroll: true,
            onSuccess: () => {
                reset();
                onClose();
            },
        });
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => !processing && onClose()}
            title="Create Committee"
            maxWidth="md"
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                {!projectId && projects.length > 0 && (
                    <div>
                        <Label>Event</Label>
                        <select
                            value={activeProjectId}
                            onChange={(e) => setSelectedProjectId(e.target.value)}
                            className="w-full mt-1 p-2.5 text-[14px] bg-[color:var(--soft-surface)] text-[color:var(--text)] border border-[color:var(--border)] rounded-[8px] focus:outline-none focus:border-[color:var(--primary)]"
                        >
                            {projects.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.title}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                <FormField
                    label="Committee name"
                    name="name"
                    value={data.name}
                    onChange={(e) => setData('name', e.target.value)}
                    error={errors.name}
                    placeholder="e.g. Technical Documentation, Logistics, Frontend"
                    required
                />

                <div>
                    <Label>Description</Label>
                    <textarea
                        rows={3}
                        value={data.description}
                        onChange={(e) => setData('description', e.target.value)}
                        placeholder="Brief overview of committee scope and responsibilities"
                        className="w-full mt-1 p-2 text-[14px] bg-[color:var(--soft-surface)] text-[color:var(--text)] border border-[color:var(--border)] rounded-[8px] focus:outline-none focus:border-[color:var(--primary)]"
                    />
                    <InputError message={errors.description} />
                </div>

                <div className="space-y-4 pt-1 border-t border-[color:var(--border)]">
                    <div>
                        <Label htmlFor="modal-committee-chair">Chairperson (Optional)</Label>
                        <select
                            id="modal-committee-chair"
                            value={data.user_id}
                            onChange={(e) => setData('user_id', e.target.value)}
                            className="w-full mt-1 p-2 text-[14px] bg-[color:var(--soft-surface)] text-[color:var(--text)] border border-[color:var(--border)] rounded-[8px] focus:outline-none focus:border-[color:var(--primary)] cursor-pointer"
                        >
                            <option value="">-- None (Assign later) --</option>
                            {candidates.map((u) => (
                                <option
                                    key={u.id}
                                    value={u.id}
                                    disabled={String(u.id) === String(data.co_chair_id)}
                                >
                                    {u.name} ({u.email}) {String(u.id) === String(data.co_chair_id) ? '(Selected as Co-Chair)' : ''}
                                </option>
                            ))}
                        </select>
                        <InputError message={errors.user_id} />
                    </div>

                    <div>
                        <Label htmlFor="modal-committee-cochair">Co-Chair (Optional)</Label>
                        <select
                            id="modal-committee-cochair"
                            value={data.co_chair_id}
                            onChange={(e) => setData('co_chair_id', e.target.value)}
                            className="w-full mt-1 p-2 text-[14px] bg-[color:var(--soft-surface)] text-[color:var(--text)] border border-[color:var(--border)] rounded-[8px] focus:outline-none focus:border-[color:var(--primary)] cursor-pointer"
                        >
                            <option value="">-- None (Assign later) --</option>
                            {candidates.map((u) => (
                                <option
                                    key={u.id}
                                    value={u.id}
                                    disabled={String(u.id) === String(data.user_id)}
                                >
                                    {u.name} ({u.email}) {String(u.id) === String(data.user_id) ? '(Selected as Chairperson)' : ''}
                                </option>
                            ))}
                        </select>
                        <InputError message={errors.co_chair_id} />
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={onClose}
                        disabled={processing}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        variant="primary"
                        isLoading={processing}
                    >
                        Create committee
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
