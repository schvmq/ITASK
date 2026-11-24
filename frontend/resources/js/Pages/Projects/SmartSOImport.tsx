import React, { useState, useRef } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import { AppLayout } from '@/Layouts/AppLayout';
import { Button } from '@/Components/Button';
import { Badge } from '@/Components/Badge';
import { Card } from '@/Components/Card';
import {
    FileText,
    UploadCloud,
    CheckCircle2,
    AlertTriangle,
    Users,
    Briefcase,
    Calendar,
    ArrowLeft,
    Sparkles,
    Check,
    ChevronDown,
    ChevronRight,
    ShieldCheck,
    RefreshCw,
    FolderPlus,
    UserCheck,
    UserX,
    FileCheck,
    HelpCircle
} from 'lucide-react';

export interface CandidateUser {
    id: number;
    name: string;
    email: string;
    score?: number;
}

export interface MatchedPersonnel {
    name: string;
    user_id: number | null;
    matched_name?: string | null;
    matched_email?: string | null;
    matched: boolean;
    confidence: 'exact' | 'high' | 'unmatched';
    candidates?: CandidateUser[];
}

export interface DeliverableItem {
    title: string;
    description: string;
    selected: boolean;
}

export interface CommitteeStructure {
    name: string;
    description?: string;
    chairperson: MatchedPersonnel;
    co_chairs: MatchedPersonnel[];
    members: MatchedPersonnel[];
    suggested_deliverables?: DeliverableItem[];
}

export interface ParsedSOData {
    so_number: string;
    event_title: string;
    submission_deadline: string;
    overall_chair: MatchedPersonnel;
    event_co_chairs: MatchedPersonnel[];
    committees: CommitteeStructure[];
    suggested_deliverables: DeliverableItem[];
    all_candidates?: CandidateUser[];
}

interface SmartSOImportProps {
    users: CandidateUser[];
    currentUser: { id: number; name: string; email: string };
}

export default function SmartSOImport({ users = [], currentUser }: SmartSOImportProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isParsing, setIsParsing] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [parsedData, setParsedData] = useState<ParsedSOData | null>(null);
    const [tempFilePath, setTempFilePath] = useState<string | null>(null);
    const [originalFileName, setOriginalFileName] = useState<string | null>(null);
    const [expandedCommittees, setExpandedCommittees] = useState<Record<number, boolean>>({
        0: true,
        1: true,
    });

    const candidateList = parsedData?.all_candidates && parsedData.all_candidates.length > 0
        ? parsedData.all_candidates
        : users;

    // Handle Upload & Parse
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsParsing(true);
        setErrorMsg(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const csrfToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';
            const res = await fetch('/projects/smart-import/parse', {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': csrfToken,
                    'Accept': 'application/json',
                },
                body: formData,
            });

            const result = await res.json();
            if (result.success && result.data) {
                setParsedData(result.data);
                setTempFilePath(result.temp_file_path || null);
                setOriginalFileName(result.original_name || file.name);
            } else {
                setErrorMsg(result.error || 'Unable to parse document. Please try again.');
            }
        } catch (err: any) {
            setErrorMsg(err.message || 'Error uploading Special Order document.');
        } finally {
            setIsParsing(false);
        }
    };

    // Load Sample S.O. No. 755
    const handleLoadSample = async () => {
        setIsParsing(true);
        setErrorMsg(null);

        try {
            const csrfToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';
            const res = await fetch('/projects/smart-import/parse', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    'Accept': 'application/json',
                },
                body: JSON.stringify({ sample: true }),
            });

            const result = await res.json();
            if (result.success && result.data) {
                setParsedData(result.data);
                setTempFilePath(null);
                setOriginalFileName('Special_Order_No_755_s2025.pdf');
            } else {
                setErrorMsg('Failed to load sample document.');
            }
        } catch (err: any) {
            setErrorMsg(err.message || 'Error loading sample document.');
        } finally {
            setIsParsing(false);
        }
    };

    // Toggle Committee Expansion
    const toggleCommitteeExpand = (index: number) => {
        setExpandedCommittees(prev => ({
            ...prev,
            [index]: !prev[index],
        }));
    };

    // Update Overall Chair User ID
    const handleOverallChairChange = (userId: number) => {
        if (!parsedData) return;
        const matchedUser = candidateList.find(u => u.id === userId);
        setParsedData({
            ...parsedData,
            overall_chair: {
                ...parsedData.overall_chair,
                user_id: userId,
                matched_name: matchedUser?.name,
                matched_email: matchedUser?.email,
                matched: true,
                confidence: 'high',
            },
        });
    };

    // Update Event Co-Chair User ID
    const handleEventCoChairChange = (index: number, userId: number) => {
        if (!parsedData) return;
        const updated = [...parsedData.event_co_chairs];
        const matchedUser = candidateList.find(u => u.id === userId);
        updated[index] = {
            ...updated[index],
            user_id: userId,
            matched_name: matchedUser?.name,
            matched_email: matchedUser?.email,
            matched: true,
            confidence: 'high',
        };
        setParsedData({
            ...parsedData,
            event_co_chairs: updated,
        });
    };

    // Update Committee Chairperson User ID
    const handleCommitteeChairChange = (cIndex: number, userId: number) => {
        if (!parsedData) return;
        const updatedCommittees = [...parsedData.committees];
        const matchedUser = candidateList.find(u => u.id === userId);
        updatedCommittees[cIndex].chairperson = {
            ...updatedCommittees[cIndex].chairperson,
            user_id: userId,
            matched_name: matchedUser?.name,
            matched_email: matchedUser?.email,
            matched: true,
            confidence: 'high',
        };
        setParsedData({
            ...parsedData,
            committees: updatedCommittees,
        });
    };

    // Update Committee Co-Chair User ID
    const handleCommitteeCoChairChange = (cIndex: number, coChairIndex: number, userId: number) => {
        if (!parsedData) return;
        const updatedCommittees = [...parsedData.committees];
        const matchedUser = candidateList.find(u => u.id === userId);
        updatedCommittees[cIndex].co_chairs[coChairIndex] = {
            ...updatedCommittees[cIndex].co_chairs[coChairIndex],
            user_id: userId,
            matched_name: matchedUser?.name,
            matched_email: matchedUser?.email,
            matched: true,
            confidence: 'high',
        };
        setParsedData({
            ...parsedData,
            committees: updatedCommittees,
        });
    };

    // Update Committee Member User ID
    const handleCommitteeMemberChange = (cIndex: number, memberIndex: number, userId: number) => {
        if (!parsedData) return;
        const updatedCommittees = [...parsedData.committees];
        const matchedUser = candidateList.find(u => u.id === userId);
        updatedCommittees[cIndex].members[memberIndex] = {
            ...updatedCommittees[cIndex].members[memberIndex],
            user_id: userId,
            matched_name: matchedUser?.name,
            matched_email: matchedUser?.email,
            matched: true,
            confidence: 'high',
        };
        setParsedData({
            ...parsedData,
            committees: updatedCommittees,
        });
    };

    // Toggle Deliverable Selection for Committee
    const handleToggleDeliverable = (cIndex: number, dIndex: number) => {
        if (!parsedData) return;
        const updatedCommittees = [...parsedData.committees];
        const currentCommittee = updatedCommittees[cIndex];
        const delivs = currentCommittee.suggested_deliverables || parsedData.suggested_deliverables;
        const updatedDelivs = [...delivs];
        updatedDelivs[dIndex] = {
            ...updatedDelivs[dIndex],
            selected: !updatedDelivs[dIndex].selected,
        };
        updatedCommittees[cIndex].suggested_deliverables = updatedDelivs;
        setParsedData({
            ...parsedData,
            committees: updatedCommittees,
        });
    };

    // Confirm & Submit
    const handleConfirmImport = () => {
        if (!parsedData) return;

        // Validation safeguard: Overall Chair must have an assigned account
        if (!parsedData.overall_chair.user_id) {
            setErrorMsg('Please select a registered account for the Overall Chair before continuing.');
            return;
        }

        setIsSubmitting(true);
        setErrorMsg(null);

        const payload = {
            so_number: parsedData.so_number,
            event_title: parsedData.event_title,
            submission_deadline: parsedData.submission_deadline,
            overall_chair_user_id: parsedData.overall_chair.user_id,
            event_co_chair_user_ids: parsedData.event_co_chairs
                .map(c => c.user_id)
                .filter((id): id is number => typeof id === 'number' && id > 0),
            temp_file_path: tempFilePath,
            original_name: originalFileName,
            committees: parsedData.committees.map(c => ({
                name: c.name,
                description: c.description,
                chairperson_user_id: c.chairperson.user_id,
                co_chair_user_ids: c.co_chairs
                    .map(co => co.user_id)
                    .filter((id): id is number => typeof id === 'number' && id > 0),
                member_user_ids: c.members
                    .map(m => m.user_id)
                    .filter((id): id is number => typeof id === 'number' && id > 0),
                deliverables: (c.suggested_deliverables || parsedData.suggested_deliverables || []).map(d => ({
                    title: d.title,
                    description: d.description,
                    selected: d.selected,
                })),
            })),
        };

        router.post('/projects/smart-import/confirm', payload, {
            onError: (errors) => {
                setIsSubmitting(false);
                setErrorMsg(Object.values(errors).flat().join(', ') || 'Failed to create event structure.');
            },
        });
    };

    // Calculate match stats
    const stats = React.useMemo(() => {
        if (!parsedData) return { total: 0, matched: 0, unmatched: 0 };
        let total = 0;
        let matched = 0;

        // Overall Chair
        total++;
        if (parsedData.overall_chair.user_id) matched++;

        // Event Co-Chairs
        parsedData.event_co_chairs.forEach(c => {
            total++;
            if (c.user_id) matched++;
        });

        // Committees
        parsedData.committees.forEach(comm => {
            total++;
            if (comm.chairperson.user_id) matched++;

            comm.co_chairs.forEach(co => {
                total++;
                if (co.user_id) matched++;
            });

            comm.members.forEach(m => {
                total++;
                if (m.user_id) matched++;
            });
        });

        return {
            total,
            matched,
            unmatched: total - matched,
        };
    }, [parsedData]);

    return (
        <AppLayout hidePageHeadingBanner={true}>
            <Head title="Smart S.O. Import" />

            <div className="max-w-6xl mx-auto space-y-6 pb-12">
                {/* ══ Breadcrumbs & Header ══ */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[color:var(--border)]">
                    <div>
                        <div className="flex items-center gap-2 text-sm text-[color:var(--muted)] mb-1">
                            <Link href="/projects" className="hover:text-[color:var(--primary)] flex items-center gap-1 transition-colors">
                                <ArrowLeft className="w-3.5 h-3.5" />
                                <span>Events</span>
                            </Link>
                            <span>/</span>
                            <span className="text-[color:var(--text)] font-medium">Smart S.O. Import</span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-[color:var(--text)] tracking-tight flex items-center gap-2.5">
                            <Sparkles className="w-6 h-6 text-emerald-500 shrink-0" />
                            Smart Special Order (S.O.) Import
                        </h1>
                        <p className="text-sm text-[color:var(--muted)] mt-1">
                            Automated Special Order parsing, committee layout generation, and personnel matching with review verification.
                        </p>
                    </div>

                    {parsedData && (
                        <div className="flex items-center gap-2 shrink-0">
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                    setParsedData(null);
                                    setTempFilePath(null);
                                }}
                                leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                            >
                                Re-upload / Reset
                            </Button>
                        </div>
                    )}
                </div>

                {errorMsg && (
                    <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-sm flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold">Notice</p>
                            <p>{errorMsg}</p>
                        </div>
                    </div>
                )}

                {/* ═══════════════════════════════════════════════════
                    PHASE 1: UPLOAD & EXTRACTION DROPZONE
                ═══════════════════════════════════════════════════ */}
                {!parsedData && (
                    <div className="space-y-6">
                        <Card className="p-8 border-dashed border-2 border-[color:var(--border)] hover:border-emerald-500/50 transition-all text-center">
                            <div className="max-w-md mx-auto space-y-4">
                                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto shadow-inner">
                                    <UploadCloud className="w-8 h-8" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-[color:var(--text)]">
                                        Upload University Special Order (PDF)
                                    </h3>
                                    <p className="text-xs text-[color:var(--muted)] mt-1">
                                        Drop your university Special Order or task force document (PDF, up to 20MB).
                                    </p>
                                </div>

                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".pdf,.docx,.txt"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                />

                                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                                    <Button
                                        variant="primary"
                                        size="md"
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 w-full sm:w-auto"
                                        disabled={isParsing}
                                        onClick={() => fileInputRef.current?.click()}
                                        leftIcon={isParsing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                                    >
                                        {isParsing ? 'Parsing Document...' : 'Select S.O. Document'}
                                    </Button>

                                    <span className="text-xs text-[color:var(--muted)] font-medium">or</span>

                                    <Button
                                        variant="secondary"
                                        size="md"
                                        disabled={isParsing}
                                        onClick={handleLoadSample}
                                        className="w-full sm:w-auto border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                                        leftIcon={<Sparkles className="w-4 h-4 text-emerald-500" />}
                                    >
                                        Load Sample S.O. No. 755
                                    </Button>
                                </div>
                            </div>
                        </Card>

                        {/* Informational Guidelines Card */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Card className="p-4 space-y-2 border-[color:var(--border)]">
                                <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--text)]">
                                    <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                                    <span>Human Verification</span>
                                </div>
                                <p className="text-xs text-[color:var(--muted)] leading-relaxed">
                                    Extraction is never committed blind. The Overall Chair reviews every extracted personnel mapping and committee deliverable before saving.
                                </p>
                            </Card>

                            <Card className="p-4 space-y-2 border-[color:var(--border)]">
                                <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--text)]">
                                    <Users className="w-4 h-4 text-blue-500 shrink-0" />
                                    <span>Dual Roles Preserved</span>
                                </div>
                                <p className="text-xs text-[color:var(--muted)] leading-relaxed">
                                    Personnel serving simultaneously as Event Co-Chairs and Committee Chairpersons have both designations preserved accurately.
                                </p>
                            </Card>

                            <Card className="p-4 space-y-2 border-[color:var(--border)]">
                                <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--text)]">
                                    <FileCheck className="w-4 h-4 text-purple-500 shrink-0" />
                                    <span>Official Documentation</span>
                                </div>
                                <p className="text-xs text-[color:var(--muted)] leading-relaxed">
                                    The uploaded Special Order document is securely stored as the event's permanent Project Approval Document.
                                </p>
                            </Card>
                        </div>
                    </div>
                )}

                {/* ═══════════════════════════════════════════════════
                    PHASE 2: REVIEW & CONFIRMATION SCREEN
                ═══════════════════════════════════════════════════ */}
                {parsedData && (
                    <div className="space-y-6">
                        {/* ── Top Metric Stats Bar (matching PDF Page 3) ── */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <Card className="p-4 bg-[color:var(--surface)] border-[color:var(--border)] shadow-sm">
                                <div className="text-xs text-[color:var(--muted)] uppercase font-semibold tracking-wider">
                                    Document Reference
                                </div>
                                <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1 truncate" title={parsedData.so_number}>
                                    {parsedData.so_number}
                                </div>
                                <div className="text-[11px] text-[color:var(--muted)] mt-0.5">
                                    Status: Draft Verification
                                </div>
                            </Card>

                            <Card className="p-4 bg-[color:var(--surface)] border-[color:var(--border)] shadow-sm">
                                <div className="text-xs text-[color:var(--muted)] uppercase font-semibold tracking-wider">
                                    Committees / Groups
                                </div>
                                <div className="text-2xl font-black text-[color:var(--text)] mt-1">
                                    {parsedData.committees.length}
                                </div>
                                <div className="text-[11px] text-[color:var(--muted)] mt-0.5">
                                    6 Criteria + 2 Prep Groups
                                </div>
                            </Card>

                            <Card className="p-4 bg-[color:var(--surface)] border-[color:var(--border)] shadow-sm">
                                <div className="text-xs text-[color:var(--muted)] uppercase font-semibold tracking-wider">
                                    Event Co-Chairs
                                </div>
                                <div className="text-2xl font-black text-indigo-500 mt-1">
                                    {parsedData.event_co_chairs.length}
                                </div>
                                <div className="text-[11px] text-[color:var(--muted)] mt-0.5">
                                    Executive leadership team
                                </div>
                            </Card>

                            <Card className="p-4 bg-[color:var(--surface)] border-[color:var(--border)] shadow-sm">
                                <div className="text-xs text-[color:var(--muted)] uppercase font-semibold tracking-wider">
                                    Personnel Matching
                                </div>
                                <div className="text-2xl font-black mt-1 flex items-center gap-1.5">
                                    <span className="text-emerald-500">{stats.matched}</span>
                                    <span className="text-[color:var(--muted)] text-sm font-normal">/ {stats.total}</span>
                                </div>
                                <div className="text-[11px] text-[color:var(--muted)] mt-0.5">
                                    {stats.unmatched > 0 ? (
                                        <span className="text-amber-500 font-medium">{stats.unmatched} require account selection</span>
                                    ) : (
                                        <span className="text-emerald-500 font-medium">All accounts mapped</span>
                                    )}
                                </div>
                            </Card>
                        </div>

                        {/* ── Event Details & Executive Leadership Card ── */}
                        <Card className="p-6 space-y-6 border-[color:var(--border)]">
                            <div className="flex items-center justify-between pb-3 border-b border-[color:var(--border)]">
                                <div className="flex items-center gap-2">
                                    <Briefcase className="w-5 h-5 text-emerald-500" />
                                    <h2 className="text-lg font-bold text-[color:var(--text)]">
                                        Event & Executive Leadership
                                    </h2>
                                </div>
                                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                    S.O. Extracted
                                </Badge>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-[color:var(--muted)] uppercase tracking-wider">
                                        Event Title
                                    </label>
                                    <input
                                        type="text"
                                        value={parsedData.event_title}
                                        onChange={e => setParsedData({ ...parsedData, event_title: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg)] text-[color:var(--text)] text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-[color:var(--muted)] uppercase tracking-wider">
                                            S.O. Number
                                        </label>
                                        <input
                                            type="text"
                                            value={parsedData.so_number}
                                            onChange={e => setParsedData({ ...parsedData, so_number: e.target.value })}
                                            className="w-full px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg)] text-[color:var(--text)] text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-[color:var(--muted)] uppercase tracking-wider">
                                            Target Deadline
                                        </label>
                                        <input
                                            type="date"
                                            value={parsedData.submission_deadline}
                                            onChange={e => setParsedData({ ...parsedData, submission_deadline: e.target.value })}
                                            className="w-full px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg)] text-[color:var(--text)] text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Overall Chair & Event Co-Chairs */}
                            <div className="pt-2 space-y-4">
                                {/* Overall Chair */}
                                <div className="p-4 rounded-xl bg-[color:var(--bg)] border border-[color:var(--border)] space-y-2">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <div>
                                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                                                Overall Chair (Project Leader)
                                            </span>
                                            <div className="text-sm font-semibold text-[color:var(--text)] mt-0.5">
                                                {parsedData.overall_chair.name}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {parsedData.overall_chair.matched ? (
                                                <Badge variant="success" className="flex items-center gap-1">
                                                    <UserCheck className="w-3 h-3" />
                                                    <span>Matched: {parsedData.overall_chair.matched_name}</span>
                                                </Badge>
                                            ) : (
                                                <Badge variant="warning" className="flex items-center gap-1 bg-amber-500/10 text-amber-600 border border-amber-500/30">
                                                    <AlertTriangle className="w-3 h-3" />
                                                    <span>Requires Verification</span>
                                                </Badge>
                                            )}

                                            <select
                                                value={parsedData.overall_chair.user_id || ''}
                                                onChange={e => handleOverallChairChange(Number(e.target.value))}
                                                className="px-2.5 py-1.5 rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text)] text-xs font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                                            >
                                                <option value="">-- Assign iTasks Account --</option>
                                                {candidateList.map(u => (
                                                    <option key={u.id} value={u.id}>
                                                        {u.name} ({u.email})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Event Co-Chairs */}
                                <div className="space-y-2">
                                    <div className="text-xs font-semibold text-[color:var(--muted)] uppercase tracking-wider flex items-center justify-between">
                                        <span>Event Co-Chairs ({parsedData.event_co_chairs.length})</span>
                                        <span className="text-[11px] font-normal lowercase text-[color:var(--muted)]">Designated at event level</span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                        {parsedData.event_co_chairs.map((coChair, idx) => (
                                            <div key={idx} className="p-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] flex items-center justify-between gap-3 text-xs">
                                                <div className="min-w-0">
                                                    <div className="font-semibold text-[color:var(--text)] truncate">
                                                        {coChair.name}
                                                    </div>
                                                    <div className="text-[11px] text-[color:var(--muted)] flex items-center gap-1 mt-0.5">
                                                        {coChair.matched ? (
                                                            <span className="text-emerald-500 font-medium">✓ {coChair.matched_name}</span>
                                                        ) : (
                                                            <span className="text-amber-500">Unlinked account</span>
                                                        )}
                                                    </div>
                                                </div>

                                                <select
                                                    value={coChair.user_id || ''}
                                                    onChange={e => handleEventCoChairChange(idx, Number(e.target.value))}
                                                    className="w-44 px-2 py-1 rounded border border-[color:var(--border)] bg-[color:var(--bg)] text-[color:var(--text)] text-[11px] truncate focus:outline-none"
                                                >
                                                    <option value="">-- Assign User --</option>
                                                    {candidateList.map(u => (
                                                        <option key={u.id} value={u.id}>
                                                            {u.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </Card>

                        {/* ── Extracted Committees & Role Structure (8 Groups) ── */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-bold text-[color:var(--text)] flex items-center gap-2">
                                        <Users className="w-5 h-5 text-indigo-500" />
                                        Extracted Committee Structures ({parsedData.committees.length})
                                    </h2>
                                    <p className="text-xs text-[color:var(--muted)] mt-0.5">
                                        Review Chairpersons, Co-Chairs, Committee Members, and suggested deliverables for each group.
                                    </p>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => {
                                            const allExpanded: Record<number, boolean> = {};
                                            parsedData.committees.forEach((_, i) => (allExpanded[i] = true));
                                            setExpandedCommittees(allExpanded);
                                        }}
                                        className="text-xs text-[color:var(--primary)] hover:underline"
                                    >
                                        Expand all
                                    </button>
                                    <span className="text-[color:var(--border)]">|</span>
                                    <button
                                        onClick={() => setExpandedCommittees({})}
                                        className="text-xs text-[color:var(--muted)] hover:underline"
                                    >
                                        Collapse all
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {parsedData.committees.map((committee, cIndex) => {
                                    const isExpanded = expandedCommittees[cIndex] ?? false;
                                    const delivs = committee.suggested_deliverables || parsedData.suggested_deliverables || [];
                                    const selectedDelivsCount = delivs.filter(d => d.selected).length;

                                    return (
                                        <Card key={cIndex} className="overflow-hidden border-[color:var(--border)] transition-all">
                                            {/* Committee Header Accordion Toggle */}
                                            <div
                                                onClick={() => toggleCommitteeExpand(cIndex)}
                                                className="p-4 bg-[color:var(--surface)] hover:bg-[color:var(--soft-surface)] cursor-pointer flex items-center justify-between gap-3 border-b border-[color:var(--border)]"
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold text-xs shrink-0">
                                                        {cIndex + 1}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <h3 className="text-sm font-bold text-[color:var(--text)] truncate">
                                                            {committee.name}
                                                        </h3>
                                                        <p className="text-xs text-[color:var(--muted)] truncate mt-0.5">
                                                            Chair: {committee.chairperson.name} &bull; {committee.co_chairs.length} Co-Chairs &bull; {committee.members.length} Members
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3 shrink-0">
                                                    <Badge variant="secondary" className="text-xs">
                                                        {selectedDelivsCount} Deliverables
                                                    </Badge>
                                                    {isExpanded ? (
                                                        <ChevronDown className="w-4 h-4 text-[color:var(--muted)]" />
                                                    ) : (
                                                        <ChevronRight className="w-4 h-4 text-[color:var(--muted)]" />
                                                    )}
                                                </div>
                                            </div>

                                            {/* Committee Body */}
                                            {isExpanded && (
                                                <div className="p-5 space-y-5 bg-[color:var(--bg)]/50">
                                                    {/* Description */}
                                                    {committee.description && (
                                                        <p className="text-xs text-[color:var(--muted)] italic">
                                                            {committee.description}
                                                        </p>
                                                    )}

                                                    {/* Roles Layout: Chair & Co-Chairs */}
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {/* Chairperson */}
                                                        <div className="p-3.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] space-y-2">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                                                                    Committee Chairperson
                                                                </span>
                                                                {committee.chairperson.matched ? (
                                                                    <span className="text-[11px] text-emerald-500 font-medium">✓ Matched</span>
                                                                ) : (
                                                                    <span className="text-[11px] text-amber-500 font-medium">⚠ Review Needed</span>
                                                                )}
                                                            </div>
                                                            <div className="text-sm font-semibold text-[color:var(--text)]">
                                                                {committee.chairperson.name}
                                                            </div>
                                                            <select
                                                                value={committee.chairperson.user_id || ''}
                                                                onChange={e => handleCommitteeChairChange(cIndex, Number(e.target.value))}
                                                                className="w-full px-2.5 py-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg)] text-[color:var(--text)] text-xs focus:outline-none"
                                                            >
                                                                <option value="">-- Assign Chairperson Account --</option>
                                                                {candidateList.map(u => (
                                                                    <option key={u.id} value={u.id}>
                                                                        {u.name} ({u.email})
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>

                                                        {/* Co-Chairs */}
                                                        <div className="p-3.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] space-y-2">
                                                            <span className="text-[11px] font-bold text-indigo-500 uppercase tracking-wider block">
                                                                Committee Co-Chairs ({committee.co_chairs.length})
                                                            </span>

                                                            <div className="space-y-2">
                                                                {committee.co_chairs.map((coChair, coIdx) => (
                                                                    <div key={coIdx} className="flex items-center justify-between gap-2 text-xs">
                                                                        <span className="font-medium text-[color:var(--text)] truncate max-w-[140px]">
                                                                            {coChair.name}
                                                                        </span>
                                                                        <select
                                                                            value={coChair.user_id || ''}
                                                                            onChange={e => handleCommitteeCoChairChange(cIndex, coIdx, Number(e.target.value))}
                                                                            className="w-40 px-2 py-1 rounded border border-[color:var(--border)] bg-[color:var(--bg)] text-[color:var(--text)] text-[11px] truncate focus:outline-none"
                                                                        >
                                                                            <option value="">-- Select User --</option>
                                                                            {candidateList.map(u => (
                                                                                <option key={u.id} value={u.id}>
                                                                                    {u.name}
                                                                                </option>
                                                                            ))}
                                                                        </select>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Committee Members */}
                                                    <div className="p-3.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[11px] font-bold text-[color:var(--muted)] uppercase tracking-wider">
                                                                Committee Members ({committee.members.length})
                                                            </span>
                                                            <span className="text-[11px] text-[color:var(--muted)]">
                                                                Assign registered accounts
                                                            </span>
                                                        </div>

                                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                                                            {committee.members.map((member, mIdx) => (
                                                                <div key={mIdx} className="p-2.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg)] space-y-1.5 text-xs">
                                                                    <div className="flex items-center justify-between gap-1">
                                                                        <span className="font-semibold text-[color:var(--text)] truncate" title={member.name}>
                                                                            {member.name}
                                                                        </span>
                                                                        {member.matched ? (
                                                                            <span className="text-emerald-500 text-[10px]">✓</span>
                                                                        ) : (
                                                                            <span className="text-amber-500 text-[10px]">?</span>
                                                                        )}
                                                                    </div>
                                                                    <select
                                                                        value={member.user_id || ''}
                                                                        onChange={e => handleCommitteeMemberChange(cIndex, mIdx, Number(e.target.value))}
                                                                        className="w-full px-2 py-1 rounded border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text)] text-[11px] truncate focus:outline-none"
                                                                    >
                                                                        <option value="">-- Assign Member --</option>
                                                                        {candidateList.map(u => (
                                                                            <option key={u.id} value={u.id}>
                                                                                {u.name}
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Proposed Deliverables for this Committee */}
                                                    <div className="p-3.5 rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface)]/50 space-y-2.5">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                                                                <FileCheck className="w-3.5 h-3.5" />
                                                                Suggested Deliverables (Page 3 Indicators)
                                                            </span>
                                                            <span className="text-[11px] text-[color:var(--muted)]">
                                                                Checked items will be created as committee activities
                                                            </span>
                                                        </div>

                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                                                            {delivs.map((deliv, dIdx) => (
                                                                <label
                                                                    key={dIdx}
                                                                    className={`p-2.5 rounded-lg border text-xs cursor-pointer flex items-start gap-2.5 transition-all ${
                                                                        deliv.selected
                                                                            ? 'border-emerald-500/40 bg-emerald-500/5 text-[color:var(--text)]'
                                                                            : 'border-[color:var(--border)] bg-[color:var(--bg)] text-[color:var(--muted)] opacity-60'
                                                                    }`}
                                                                >
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={deliv.selected}
                                                                        onChange={() => handleToggleDeliverable(cIndex, dIdx)}
                                                                        className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                                                                    />
                                                                    <div>
                                                                        <div className="font-semibold">{deliv.title}</div>
                                                                        <div className="text-[11px] text-[color:var(--muted)] mt-0.5">{deliv.description}</div>
                                                                    </div>
                                                                </label>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </Card>
                                    );
                                })}
                            </div>
                        </div>

                        {/* ── Action & Confirmation Bar ── */}
                        <Card className="p-6 border-[color:var(--border)] bg-gradient-to-r from-emerald-500/5 via-[color:var(--surface)] to-indigo-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2 text-sm font-bold text-[color:var(--text)]">
                                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                                    <span>Ready to Generate Event Structure</span>
                                </div>
                                <p className="text-xs text-[color:var(--muted)]">
                                    Will create Project, {parsedData.committees.length} Committees, {parsedData.event_co_chairs.length} Event Co-Chairs, and linked deliverables cleanly.
                                </p>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                                <Button
                                    variant="secondary"
                                    size="md"
                                    onClick={() => setParsedData(null)}
                                    disabled={isSubmitting}
                                >
                                    Cancel
                                </Button>

                                <Button
                                    variant="primary"
                                    size="md"
                                    onClick={handleConfirmImport}
                                    disabled={isSubmitting || !parsedData.overall_chair.user_id}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 shadow-lg shadow-emerald-600/20"
                                    leftIcon={isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                >
                                    {isSubmitting ? 'Creating Structure...' : 'Confirm & Create Event Structure'}
                                </Button>
                            </div>
                        </Card>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}

