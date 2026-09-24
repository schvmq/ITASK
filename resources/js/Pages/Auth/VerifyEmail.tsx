import React, { useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import { GuestLayout } from '@/Layouts/GuestLayout';
import { Button, Alert } from '@/Components';

export interface VerifyEmailProps {
    email?: string;
}

export default function VerifyEmail({ email = 'account@carsu.edu.ph' }: VerifyEmailProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);

    const handleResend = (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setStatusMessage(null);

        // Simulated resend for Day 2 UI demonstration
        setTimeout(() => {
            setIsLoading(false);
            setStatusMessage('A fresh verification link has been sent to your institutional email address.');
        }, 1200);
    };

    return (
        <GuestLayout
            title="Verify Institutional Email"
            subtitle="Security confirmation required for ITASK access"
        >
            <Head title="Verify Email — ITASK" />

            <div className="text-center mb-6">
                <div className="w-14 h-14 bg-orange-50 border border-orange-200 text-[#F68233] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xs">
                    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                    </svg>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
                    Before accessing protected ITASK functions (including projects, committees, activities, and tasks), you must verify your institutional email address. A verification link was sent to:
                </p>

                <div className="mt-3 inline-block px-3.5 py-1.5 bg-slate-100 rounded-lg border border-slate-200 text-xs font-semibold text-slate-800 tracking-wide">
                    {email}
                </div>
            </div>

            {statusMessage && (
                <Alert variant="success" className="mb-5">
                    {statusMessage}
                </Alert>
            )}

            <form onSubmit={handleResend} className="space-y-4">
                <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    isLoading={isLoading}
                    className="w-full justify-center font-semibold"
                >
                    Resend Verification Email
                </Button>

                <div className="flex items-center justify-between pt-2">
                    <Link
                        href="/login"
                        className="text-xs text-slate-500 hover:text-slate-800 transition underline"
                    >
                        Return to Sign In
                    </Link>

                    <Link
                        href="/login"
                        className="text-xs text-rose-600 hover:text-rose-700 transition"
                    >
                        Cancel
                    </Link>
                </div>
            </form>
        </GuestLayout>
    );
}
