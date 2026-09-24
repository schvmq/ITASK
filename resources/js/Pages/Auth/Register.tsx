import React, { useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import { GuestLayout } from '@/Layouts/GuestLayout';
import { Button, FormField, Alert } from '@/Components';

export default function Register() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirmation, setPasswordConfirmation] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setErrors({});

        const newErrors: Record<string, string> = {};

        if (!name.trim()) {
            newErrors.name = 'Full name is required.';
        }

        if (!email) {
            newErrors.email = 'Institutional email is required.';
        } else if (!email.endsWith('@carsu.edu.ph')) {
            newErrors.email = 'You must register using your institutional @carsu.edu.ph email address.';
        }

        if (!password) {
            newErrors.password = 'Password is required.';
        } else if (password.length < 8) {
            newErrors.password = 'Password must be at least 8 characters.';
        }

        if (password !== passwordConfirmation) {
            newErrors.password_confirmation = 'Passwords do not match.';
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            setIsLoading(false);
            return;
        }

        // Simulated submit for Day 2 UI demonstration
        setTimeout(() => {
            setIsLoading(false);
        }, 1200);
    };

    return (
        <GuestLayout
            title="Register Faculty Account"
            subtitle="Create an account to join projects and committees"
        >
            <Head title="Register" />

            <div className="mb-5 p-3 rounded-lg bg-orange-50/70 border border-orange-200/80 text-xs text-orange-950 flex items-start gap-2">
                <svg className="w-4 h-4 text-[#F68233] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                </svg>
                <span>
                    <strong>Notice:</strong> Only faculty members with an active <strong>@carsu.edu.ph</strong> email address are authorized to register.
                </span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <FormField
                    label="Full Name"
                    type="text"
                    name="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Dr. Juan Dela Cruz"
                    required
                    error={errors.name}
                    autoComplete="name"
                    autoFocus
                />

                <FormField
                    label="Institutional Email"
                    type="email"
                    name="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jdelacruz@carsu.edu.ph"
                    required
                    error={errors.email}
                    helperText="Official Caraga State University address"
                    autoComplete="username"
                />

                <FormField
                    label="Password"
                    type="password"
                    name="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    error={errors.password}
                    helperText="Minimum 8 characters"
                    autoComplete="new-password"
                />

                <FormField
                    label="Confirm Password"
                    type="password"
                    name="password_confirmation"
                    value={passwordConfirmation}
                    onChange={(e) => setPasswordConfirmation(e.target.value)}
                    placeholder="••••••••"
                    required
                    error={errors.password_confirmation}
                    autoComplete="new-password"
                />

                <div className="pt-2">
                    <Button
                        type="submit"
                        variant="primary"
                        size="md"
                        isLoading={isLoading}
                        className="w-full justify-center"
                    >
                        Create Account
                    </Button>
                </div>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-100 text-center">
                <p className="text-xs text-slate-600">
                    Already registered?{' '}
                    <Link
                        href="/login"
                        className="font-semibold text-[#F68233] hover:text-[#E06D1F] transition underline decoration-[#F68233]/40"
                    >
                        Sign in instead
                    </Link>
                </p>
            </div>
        </GuestLayout>
    );
}
