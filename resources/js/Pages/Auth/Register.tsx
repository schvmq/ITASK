import React from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import { GuestLayout } from '@/Layouts/GuestLayout';
import { Button, FormField } from '@/Components';

export default function Register() {
    const { data, setData, post, processing, errors } = useForm({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        post('/register');
    };

    return (
        <GuestLayout
            title="CCIS Personnel Registration"
            subtitle="Create your CCIS personnel account using your institutional email address."
        >
            <Head title="CCIS Personnel Registration" />

            <div className="mb-5 p-3 rounded-lg bg-orange-50/70 border border-orange-200/80 text-xs text-orange-950 flex items-start gap-2">
                <svg
                    className="w-4 h-4 text-[#F68233] shrink-0 mt-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 1 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"
                    />
                </svg>

                <span>
                    <strong>Requirement:</strong> Registration is restricted to
                    CCIS personnel with an active{' '}
                    <strong>@carsu.edu.ph</strong> address. Project-scoped
                    roles are assigned per project by Project Leaders.
                </span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <FormField
                    label="Full Name"
                    type="text"
                    name="name"
                    value={data.name}
                    onChange={(e) => setData('name', e.target.value)}
                    placeholder="Juan Dela Cruz"
                    required
                    error={errors.name}
                    autoComplete="name"
                    autoFocus
                />

                <FormField
                    label="Institutional Email"
                    type="email"
                    name="email"
                    value={data.email}
                    onChange={(e) => setData('email', e.target.value)}
                    placeholder="jdelacruz@carsu.edu.ph"
                    required
                    error={errors.email}
                    helperText="Must be your official @carsu.edu.ph email"
                    autoComplete="username"
                />

                <FormField
                    label="Password"
                    type="password"
                    name="password"
                    value={data.password}
                    onChange={(e) => setData('password', e.target.value)}
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
                    value={data.password_confirmation}
                    onChange={(e) =>
                        setData('password_confirmation', e.target.value)
                    }
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
                        isLoading={processing}
                        className="w-full justify-center font-semibold"
                    >
                        Register CCIS Personnel Account
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