import React, { useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import { AppLayout } from '@/Layouts/AppLayout';
import {
    Button,
    Card,
    Badge,
    Alert,
    EmptyState,
    Modal,
    Spinner,
    FormField,
} from '@/Components';

export default function Welcome() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [alertDismissed, setAlertDismissed] = useState(false);
    const [demoInput, setDemoInput] = useState('');
    const [isActionLoading, setIsActionLoading] = useState(false);

    const handleActionClick = () => {
        setIsActionLoading(true);
        setTimeout(() => setIsActionLoading(false), 1000);
    };

    return (
        <AppLayout
            title="Faculty Workflow Dashboard"
            subtitle="Overview of assigned projects, committees, and pending activity reviews"
            headerAction={
                <div className="flex items-center gap-2.5">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsModalOpen(true)}
                    >
                        Component Preview
                    </Button>
                    <Link href="/login">
                        <Button variant="primary" size="sm">
                            Sign In
                        </Button>
                    </Link>
                </div>
            }
        >
            <Head title="Dashboard & Component Showcase" />

            <div className="space-y-6">
                {/* Notice Alert */}
                {!alertDismissed && (
                    <Alert
                        variant="info"
                        title="Day 2 Frontend Foundation Ready"
                        onClose={() => setAlertDismissed(true)}
                    >
                        The frontend foundation, design tokens (primary orange{' '}
                        <code className="text-[#F68233] font-semibold">#F68233</code> and brand green{' '}
                        <code className="text-[#003300] font-semibold">#003300</code>), base layouts, and authentication pages are fully established.
                    </Alert>
                )}

                {/* Quick Navigation Cards to Auth Pages */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card padding="md" className="hover:border-slate-300 transition-colors">
                        <div className="flex items-start justify-between">
                            <Badge variant="primary" dot>Auth Page</Badge>
                            <span className="text-xs text-slate-400 font-mono">/login</span>
                        </div>
                        <h4 className="font-semibold text-slate-900 mt-3 text-base">Sign In Portal</h4>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                            Faculty login interface with @carsu.edu.ph validation and password visibility toggle.
                        </p>
                        <div className="mt-4">
                            <Link href="/login">
                                <Button variant="outline" size="sm" className="w-full justify-center">
                                    Open Login Page
                                </Button>
                            </Link>
                        </div>
                    </Card>

                    <Card padding="md" className="hover:border-slate-300 transition-colors">
                        <div className="flex items-start justify-between">
                            <Badge variant="secondary" dot>Auth Page</Badge>
                            <span className="text-xs text-slate-400 font-mono">/register</span>
                        </div>
                        <h4 className="font-semibold text-slate-900 mt-3 text-base">Faculty Registration</h4>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                            Registration with institutional email policy notice, password confirmation, and error states.
                        </p>
                        <div className="mt-4">
                            <Link href="/register">
                                <Button variant="outline" size="sm" className="w-full justify-center">
                                    Open Register Page
                                </Button>
                            </Link>
                        </div>
                    </Card>

                    <Card padding="md" className="hover:border-slate-300 transition-colors">
                        <div className="flex items-start justify-between">
                            <Badge variant="warning" dot>Auth Page</Badge>
                            <span className="text-xs text-slate-400 font-mono">/verify-email</span>
                        </div>
                        <h4 className="font-semibold text-slate-900 mt-3 text-base">Email Verification</h4>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                            Security verification requirement interface with resend verification action.
                        </p>
                        <div className="mt-4">
                            <Link href="/verify-email">
                                <Button variant="outline" size="sm" className="w-full justify-center">
                                    Open Verify Page
                                </Button>
                            </Link>
                        </div>
                    </Card>
                </div>

                {/* Component Showcase Card */}
                <Card
                    title="Reusable Design System & Component Library"
                    subtitle="Centralized design tokens and consistent variants"
                >
                    <div className="space-y-6">
                        {/* Buttons Showcase */}
                        <div>
                            <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                                Button Variants & States
                            </h5>
                            <div className="flex flex-wrap items-center gap-3">
                                <Button variant="primary">Primary (#F68233)</Button>
                                <Button variant="secondary">Secondary (#003300)</Button>
                                <Button variant="outline">Outline</Button>
                                <Button variant="danger">Danger</Button>
                                <Button variant="ghost">Ghost</Button>
                                <Button
                                    variant="primary"
                                    isLoading={isActionLoading}
                                    onClick={handleActionClick}
                                >
                                    {isActionLoading ? 'Saving...' : 'Click to Load'}
                                </Button>
                                <Button variant="primary" disabled>
                                    Disabled
                                </Button>
                            </div>
                        </div>

                        {/* Status Badges Showcase */}
                        <div className="pt-4 border-t border-slate-100">
                            <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                                Status Badges (Project, Activity & Task States)
                            </h5>
                            <div className="flex flex-wrap items-center gap-2.5">
                                <Badge variant="neutral">Planning</Badge>
                                <Badge variant="primary" dot>In Progress</Badge>
                                <Badge variant="warning" dot>Under Review</Badge>
                                <Badge variant="danger" dot>Returned for Revision</Badge>
                                <Badge variant="success" dot>Completed</Badge>
                                <Badge variant="secondary">Archived</Badge>
                            </div>
                        </div>

                        {/* Form Inputs Showcase */}
                        <div className="pt-4 border-t border-slate-100">
                            <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                                Form Controls & Error States
                            </h5>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
                                <FormField
                                    label="Default Form Field"
                                    placeholder="Enter text..."
                                    value={demoInput}
                                    onChange={(e) => setDemoInput(e.target.value)}
                                    helperText="Normal state with smooth focus ring"
                                />
                                <FormField
                                    label="Required Field With Error"
                                    required
                                    placeholder="Required value..."
                                    error="This field is required by CCIS protocol."
                                />
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Empty State Showcase */}
                <Card
                    title="Empty State Convention"
                    subtitle="Standardized pattern for lists with zero items"
                >
                    <EmptyState
                        title="No active project activities found"
                        description="Activities assigned to your committee will appear here once created by your Project Staff."
                        actionLabel="Open Component Modal"
                        onAction={() => setIsModalOpen(true)}
                    />
                </Card>
            </div>

            {/* Reusable Modal Preview */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Component Modal Preview"
                description="Demonstrating the reusable modal with accessible escape key listener and custom actions."
                footer={
                    <>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsModalOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={() => setIsModalOpen(false)}
                        >
                            Confirm Action
                        </Button>
                    </>
                }
            >
                <div className="space-y-3">
                    <p className="text-xs text-slate-600">
                        This modal is fully reusable across project creation, committee assignment, activity review, and MOV uploads.
                    </p>
                    <Alert variant="success">
                        Modal backdrop blur and keyboard accessibility (ESC) are active.
                    </Alert>
                </div>
            </Modal>
        </AppLayout>
    );
}
