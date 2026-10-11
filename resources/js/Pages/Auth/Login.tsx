import React, { useState } from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import { GuestLayout } from '@/Layouts/GuestLayout';
import { Button } from '@/Components/Button';
import { FormField } from '@/Components/FormField';
import { Checkbox } from '@/Components/Checkbox';
import { Alert } from '@/Components/Alert';

interface LoginForm {
    email: string;
    password: string;
    remember: boolean;
    general?: string;
}

export default function Login() {
    const [showPassword, setShowPassword] = useState(false);

    const { data, setData, post, processing, errors, setError, clearErrors } = useForm<LoginForm>({
        email: '',
        password: '',
        remember: false,
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        clearErrors();

        const trimmedEmail = data.email.trim();

        if (!trimmedEmail) {
            setError('email', 'Institutional email is required.');
            return;
        }

        // Institutional email validation: must be an official @carsu.edu.ph address
        const carsuEmailRegex = /^[^\s@]+@carsu\.edu\.ph$/i;
        if (!carsuEmailRegex.test(trimmedEmail)) {
            setError('email', 'Please enter your official @carsu.edu.ph institutional email.');
            return;
        }

        if (!data.password) {
            setError('password', 'Password is required.');
            return;
        }

        post('/login');
    };

    return (
        <GuestLayout
            title="Sign in to your account"
            subtitle="Access your course projects, committees, and deliverables."
        >
            <Head title="Sign In" />

            {errors.general && (
                <Alert variant="danger" className="mb-5">
                    {errors.general}
                </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <FormField
                    label="Institutional Email"
                    type="email"
                    name="email"
                    value={data.email}
                    onChange={(e) => {
                        setData('email', e.target.value);
                        if (errors.email) clearErrors('email');
                    }}
                    placeholder="username@carsu.edu.ph"
                    required
                    error={errors.email}
                    helperText="Official @carsu.edu.ph institutional address"
                    autoComplete="username"
                    autoFocus
                />

                <div className="relative">
                    <FormField
                        label="Password"
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        value={data.password}
                        onChange={(e) => {
                            setData('password', e.target.value);
                            if (errors.password) clearErrors('password');
                        }}
                        placeholder="••••••••"
                        required
                        error={errors.password}
                        autoComplete="current-password"
                    />

                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-8 text-[color:var(--muted)] hover:text-[color:var(--text)] text-[12px] transition cursor-pointer select-none"
                        tabIndex={-1}
                    >
                        {showPassword ? 'Hide' : 'Show'}
                    </button>
                </div>

                <div className="flex items-center justify-between pt-1 text-[13px]">
                    <Checkbox
                        label="Remember me"
                        checked={data.remember}
                        onChange={(e) => setData('remember', e.target.checked)}
                    />

                    <span className="text-[12px] text-[color:var(--muted)] hover:text-[color:var(--text)] cursor-pointer">
                        Forgot password?
                    </span>
                </div>

                <div className="pt-2">
                    <Button
                        type="submit"
                        variant="primary"
                        size="md"
                        isLoading={processing}
                        className="w-full justify-center"
                    >
                        Sign in
                    </Button>
                </div>
            </form>

            {/* Quick Demo Fill Accounts */}
            <div className="mt-5 p-3 rounded-[10px] bg-[color:var(--soft-surface)] border border-[color:var(--border)] text-left">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--muted)]">
                        Quick Demo Accounts (Password: password)
                    </span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                        type="button"
                        onClick={() => {
                            setData((prev) => ({ ...prev, email: 'admin.itask@carsu.edu.ph', password: 'password' }));
                            clearErrors();
                        }}
                        className="text-[11px] font-medium px-2.5 py-1 rounded-[6px] bg-[color:var(--card)] hover:bg-[color:var(--primary)] hover:text-white border border-[color:var(--border)] transition-colors cursor-pointer"
                    >
                        🛡️ Admin
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setData((prev) => ({ ...prev, email: 'bryanjay.oja@carsu.edu.ph', password: 'password' }));
                            clearErrors();
                        }}
                        className="text-[11px] font-medium px-2.5 py-1 rounded-[6px] bg-[color:var(--card)] hover:bg-[color:var(--primary)] hover:text-white border border-[color:var(--border)] transition-colors cursor-pointer"
                    >
                        👤 Bryan Jay
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setData((prev) => ({ ...prev, email: 'leader.itask@carsu.edu.ph', password: 'password' }));
                            clearErrors();
                        }}
                        className="text-[11px] font-medium px-2.5 py-1 rounded-[6px] bg-[color:var(--card)] hover:bg-[color:var(--primary)] hover:text-white border border-[color:var(--border)] transition-colors cursor-pointer"
                    >
                        👑 Leader
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setData((prev) => ({ ...prev, email: 'staff.itask@carsu.edu.ph', password: 'password' }));
                            clearErrors();
                        }}
                        className="text-[11px] font-medium px-2.5 py-1 rounded-[6px] bg-[color:var(--card)] hover:bg-[color:var(--primary)] hover:text-white border border-[color:var(--border)] transition-colors cursor-pointer"
                    >
                        ⚡ Staff
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setData((prev) => ({ ...prev, email: 'member01.itask@carsu.edu.ph', password: 'password' }));
                            clearErrors();
                        }}
                        className="text-[11px] font-medium px-2.5 py-1 rounded-[6px] bg-[color:var(--card)] hover:bg-[color:var(--primary)] hover:text-white border border-[color:var(--border)] transition-colors cursor-pointer"
                    >
                        📋 Member
                    </button>
                </div>
            </div>

            <div className="mt-6 pt-5 border-t border-[color:var(--border)] text-center space-y-2">
                <p className="text-[13px] text-[color:var(--muted)]">
                    Don't have an account?{' '}
                    <Link
                        href="/register"
                        className="font-semibold text-[color:var(--primary)] hover:underline"
                    >
                        Register here
                    </Link>
                </p>

                <p className="text-[12px] text-[color:var(--muted)]">
                    New to ITASK?{' '}
                    <Link
                        href="/dev/showcase"
                        className="text-[color:var(--muted)] hover:text-[color:var(--text)] underline"
                    >
                        View product overview
                    </Link>
                </p>
            </div>
        </GuestLayout>
    );
}