import React from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import { GuestLayout } from '@/Layouts/GuestLayout';
import { Button } from '@/Components/Button';
import { FormField } from '@/Components/FormField';
import { Info } from 'lucide-react';

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
            title="Create your account"
            subtitle="Register with your official institutional email address."
        >
            <Head title="Register" />

            <div className="mb-5 p-3 rounded-[8px] bg-[color:var(--soft-surface)] border border-[color:var(--border)] text-[12px] text-[color:var(--text)] flex items-start gap-2.5">
                <Info className="w-4 h-4 text-[color:var(--primary)] shrink-0 mt-0.5" />
                <span>
                    <strong>Requirement:</strong> Registration is restricted to
                    students and personnel with an active{' '}
                    <strong>@carsu.edu.ph</strong> address. Project-scoped
                    roles are assigned per project by Project Leaders.
                </span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <FormField
                    label="Full name"
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
                    label="Institutional email"
                    type="email"
                    name="email"
                    value={data.email}
                    onChange={(e) => setData('email', e.target.value)}
                    placeholder="username@carsu.edu.ph"
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
                    label="Confirm password"
                    type="password"
                    name="password_confirmation"
                    value={data.password_confirmation}
                    onChange={(e) => setData('password_confirmation', e.target.value)}
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
                        className="w-full justify-center"
                    >
                        Create account
                    </Button>
                </div>
            </form>

            <div className="mt-6 pt-5 border-t border-[color:var(--border)] text-center">
                <p className="text-[13px] text-[color:var(--muted)]">
                    Already registered?{' '}
                    <Link
                        href="/login"
                        className="font-semibold text-[color:var(--primary)] hover:underline"
                    >
                        Sign in here
                    </Link>
                </p>
            </div>
        </GuestLayout>
    );
}