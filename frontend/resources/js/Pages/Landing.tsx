import React from 'react';
import { Head, Link } from '@inertiajs/react';
import {
    CheckCircle2,
    Calendar,
    MessageSquare,
    Layers,
    ArrowRight,
    CheckSquare,
    Clock,
    Users,
    Shield,
    BookOpen,
} from 'lucide-react';
import { Button } from '@/Components/Button';
import { Card } from '@/Components/Card';
import { Badge } from '@/Components/Badge';
import { ThemeToggle } from '@/Components/ThemeToggle';

export default function Landing() {
    return (
        <div className="min-h-screen bg-[color:var(--background)] text-[color:var(--text)] flex flex-col font-sans selection:bg-[color:var(--primary)] selection:text-white">
            <Head>
                <title>ITASK — Project Management for Student Teams</title>
                <meta
                    name="description"
                    content="Structured project management and task coordination for student teams. Organize projects, committee deliverables, calendar timelines, and group chats."
                />
            </Head>

            {/* ══ Sticky Top Nav ══ */}
            <header className="sticky top-0 z-30 h-16 border-b border-[color:var(--border)] bg-[color:var(--card)]/90 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between">
                {/* Logo */}
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-[8px] bg-[color:var(--primary)] text-white flex items-center justify-center font-black text-sm tracking-tighter">
                        IT
                    </div>
                    <span className="font-extrabold text-[18px] tracking-tight text-[color:var(--text)]">
                        ITASK
                    </span>
                    <span className="hidden sm:inline-block text-[11px] font-semibold uppercase tracking-wider text-[color:var(--muted)] border-l border-[color:var(--border)] pl-3">
                        Student Workspaces
                    </span>
                </div>

                {/* Nav Links */}
                <nav className="hidden md:flex items-center gap-6 text-[14px] font-medium text-[color:var(--muted)]" aria-label="Main Navigation">
                    <a
                        href="#features"
                        className="hover:text-[color:var(--text)] transition-colors focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2 rounded-[4px]"
                    >
                        Features
                    </a>
                    <a
                        href="#how-it-works"
                        className="hover:text-[color:var(--text)] transition-colors focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2 rounded-[4px]"
                    >
                        How it works
                    </a>
                </nav>

                {/* Right Actions */}
                <div className="flex items-center gap-3">
                    <ThemeToggle />
                    <Link href="/login">
                        <Button variant="ghost" size="sm">
                            Log in
                        </Button>
                    </Link>
                    <Link href="/register">
                        <Button variant="primary" size="sm">
                            Sign up
                        </Button>
                    </Link>
                </div>
            </header>

            {/* ══ Hero Section ══ */}
            <main className="flex-1">
                <section className="py-16 sm:py-24 px-4 sm:px-8 max-w-5xl mx-auto text-center space-y-6">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[color:var(--border)] bg-[color:var(--soft-surface)] text-[12px] font-medium text-[color:var(--muted)]">
                        <span className="w-2 h-2 rounded-full bg-[color:var(--primary)]" />
                        Built for university capstone & student group projects
                    </div>

                    <h1 className="text-[34px] sm:text-[48px] font-extrabold tracking-tight text-[color:var(--text)] max-w-3xl mx-auto leading-tight">
                        Structured project and task coordination for student teams
                    </h1>

                    <p className="text-[16px] sm:text-[18px] text-[color:var(--muted)] max-w-2xl mx-auto leading-relaxed">
                        Organize coursework, manage committee deliverables, collaborate in project group chats, and track academic deadlines in one focused workspace.
                    </p>

                    <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                        <Link href="/register">
                            <Button variant="primary" size="lg">
                                <span>Create an account</span>
                                <ArrowRight className="w-4 h-4 ml-1.5" />
                            </Button>
                        </Link>
                        <a href="#how-it-works">
                            <Button variant="secondary" size="lg">
                                <span>See how it works</span>
                            </Button>
                        </a>
                    </div>
                </section>

                {/* ══ Live UI Component Preview (Real UI Components) ══ */}
                <section className="px-4 sm:px-8 max-w-5xl mx-auto pb-16">
                    <div className="rounded-[12px] border border-[color:var(--border)] bg-[color:var(--card)] p-4 sm:p-6 space-y-5">
                        {/* Fake App Top Bar */}
                        <div className="flex items-center justify-between pb-4 border-b border-[color:var(--border)] text-[13px]">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-[color:var(--text)]">Senior Design Thesis</span>
                                <Badge variant="accent">On track</Badge>
                            </div>
                            <span className="text-[color:var(--muted)] tabular-nums">Overall progress: 78%</span>
                        </div>

                        {/* Attention Card Preview (The only card with primary left edge) */}
                        <Card isAttention={true} className="p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <h2 className="text-[14px] font-bold text-[color:var(--text)]">Needs your attention</h2>
                                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[color:var(--status-danger-bg)] text-[color:var(--status-danger-text)] tabular-nums">
                                        2
                                    </span>
                                </div>
                                <span className="text-[12px] text-[color:var(--primary)] font-medium">Overdue first</span>
                            </div>

                            <div className="space-y-2 text-[13px]">
                                <div className="p-2.5 rounded-[8px] bg-[color:var(--soft-surface)] flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-4 h-4 rounded-[4px] border border-[color:var(--border)] flex items-center justify-center shrink-0" />
                                        <span className="font-medium text-[color:var(--text)] truncate">Chapter 3 methodology revision</span>
                                    </div>
                                    <Badge variant="danger">Overdue</Badge>
                                </div>

                                <div className="p-2.5 rounded-[8px] bg-[color:var(--soft-surface)] flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-4 h-4 rounded-[4px] border border-[color:var(--border)] flex items-center justify-center shrink-0" />
                                        <span className="font-medium text-[color:var(--text)] truncate">Database schema normalization report</span>
                                    </div>
                                    <Badge variant="secondary">Due today</Badge>
                                </div>
                            </div>
                        </Card>

                        {/* Compact Stats Row */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="p-3.5 rounded-[8px] border border-[color:var(--border)] bg-[color:var(--soft-surface)]">
                                <span className="text-[12px] text-[color:var(--muted)]">Active projects</span>
                                <p className="text-[20px] font-bold text-[color:var(--text)] tabular-nums mt-0.5">3</p>
                            </div>
                            <div className="p-3.5 rounded-[8px] border border-[color:var(--border)] bg-[color:var(--soft-surface)]">
                                <span className="text-[12px] text-[color:var(--muted)]">Tasks this week</span>
                                <p className="text-[20px] font-bold text-[color:var(--text)] tabular-nums mt-0.5">7</p>
                            </div>
                            <div className="p-3.5 rounded-[8px] border border-[color:var(--border)] bg-[color:var(--soft-surface)]">
                                <span className="text-[12px] text-[color:var(--muted)]">Completion rate</span>
                                <p className="text-[20px] font-bold text-[color:var(--status-success-text)] tabular-nums mt-0.5">85%</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ══ Three Simple Feature Cards ══ */}
                <section id="features" className="py-16 px-4 sm:px-8 max-w-5xl mx-auto border-t border-[color:var(--border)] space-y-10">
                    <div className="text-center space-y-2">
                        <h2 className="text-[24px] font-bold text-[color:var(--text)]">
                            Core features built for academic rigor
                        </h2>
                        <p className="text-[15px] text-[color:var(--muted)] max-w-xl mx-auto">
                            No bloated marketing tools. Everything you need to manage course deliverables efficiently.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        {/* Feature 1 */}
                        <Card className="p-6 space-y-3">
                            <div className="w-10 h-10 rounded-[8px] bg-[color:var(--soft-surface)] border border-[color:var(--border)] flex items-center justify-center text-[color:var(--primary)]">
                                <CheckSquare className="w-5 h-5" strokeWidth={2} />
                            </div>
                            <h3 className="text-[16px] font-bold text-[color:var(--text)]">
                                Tasks and priorities
                            </h3>
                            <p className="text-[14px] text-[color:var(--muted)] leading-relaxed">
                                Track assigned deliverables, checklist items, and approval workflows with real-time status updates and inline completion.
                            </p>
                        </Card>

                        {/* Feature 2 */}
                        <Card className="p-6 space-y-3">
                            <div className="w-10 h-10 rounded-[8px] bg-[color:var(--soft-surface)] border border-[color:var(--border)] flex items-center justify-center text-[color:var(--primary)]">
                                <MessageSquare className="w-5 h-5" strokeWidth={2} />
                            </div>
                            <h3 className="text-[16px] font-bold text-[color:var(--text)]">
                                Project group chat
                            </h3>
                            <p className="text-[14px] text-[color:var(--muted)] leading-relaxed">
                                Coordinate within committee-focused project group chats, pin critical updates, and convert discussion messages directly into action items.
                            </p>
                        </Card>

                        {/* Feature 3 */}
                        <Card className="p-6 space-y-3">
                            <div className="w-10 h-10 rounded-[8px] bg-[color:var(--soft-surface)] border border-[color:var(--border)] flex items-center justify-center text-[color:var(--primary)]">
                                <Calendar className="w-5 h-5" strokeWidth={2} />
                            </div>
                            <h3 className="text-[16px] font-bold text-[color:var(--text)]">
                                Calendar and timeline
                            </h3>
                            <p className="text-[14px] text-[color:var(--muted)] leading-relaxed">
                                Visualize upcoming deadlines across all courses and milestones on interactive calendar views and Gantt timeline charts.
                            </p>
                        </Card>
                    </div>
                </section>

                {/* ══ Three-Step How It Works ══ */}
                <section id="how-it-works" className="py-16 px-4 sm:px-8 max-w-5xl mx-auto border-t border-[color:var(--border)] space-y-10">
                    <div className="text-center space-y-2">
                        <h2 className="text-[24px] font-bold text-[color:var(--text)]">
                            How ITASK works
                        </h2>
                        <p className="text-[15px] text-[color:var(--muted)]">
                            Three simple steps from setup to project completion
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2.5">
                            <span className="text-[28px] font-black text-[color:var(--primary)] tabular-nums">01</span>
                            <h3 className="text-[16px] font-bold text-[color:var(--text)]">
                                Create or join a workspace
                            </h3>
                            <p className="text-[14px] text-[color:var(--muted)] leading-relaxed">
                                Start a new team using pre-configured academic templates or join an existing course group with a secure invite code.
                            </p>
                        </div>

                        <div className="space-y-2.5">
                            <span className="text-[28px] font-black text-[color:var(--primary)] tabular-nums">02</span>
                            <h3 className="text-[16px] font-bold text-[color:var(--text)]">
                                Organize committees & tasks
                            </h3>
                            <p className="text-[14px] text-[color:var(--muted)] leading-relaxed">
                                Break down semester deliverables into functional committees, assign deadlines to team members, and track individual progress.
                            </p>
                        </div>

                        <div className="space-y-2.5">
                            <span className="text-[28px] font-black text-[color:var(--primary)] tabular-nums">03</span>
                            <h3 className="text-[16px] font-bold text-[color:var(--text)]">
                                Review and complete
                            </h3>
                            <p className="text-[14px] text-[color:var(--muted)] leading-relaxed">
                                Submit work for review, verify deliverables, attach approval documents, and track milestones to final completion.
                            </p>
                        </div>
                    </div>
                </section>

                {/* ══ Closing Call To Action ══ */}
                <section className="py-16 px-4 sm:px-8 max-w-3xl mx-auto text-center border-t border-[color:var(--border)] space-y-5">
                    <h2 className="text-[26px] font-bold text-[color:var(--text)]">
                        Ready to organize your student team?
                    </h2>
                    <p className="text-[15px] text-[color:var(--muted)]">
                        Get started in seconds with your institutional email address.
                    </p>
                    <div className="pt-2">
                        <Link href="/register">
                            <Button variant="primary" size="lg">
                                <span>Create an account</span>
                                <ArrowRight className="w-4 h-4 ml-1.5" />
                            </Button>
                        </Link>
                    </div>
                </section>
            </main>

            {/* ══ Plain, Professional Footer ══ */}
            <footer className="border-t border-[color:var(--border)] py-8 px-4 sm:px-8 text-center text-[12px] text-[color:var(--muted)]">
                <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-[color:var(--text)]">ITASK</span>
                        <span>·</span>
                        <span>Project Management for Student Teams</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <Link href="/login" className="hover:underline">
                            Log in
                        </Link>
                        <Link href="/register" className="hover:underline">
                            Sign up
                        </Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}
