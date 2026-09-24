import React, { useState } from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import { GuestLayout } from '@/Layouts/GuestLayout';
import { Button, FormField, Checkbox, Alert } from '@/Components';

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
        <GuestLayout>
            <Head title="Sign In — ITASK" />

            <div className="mb-6 text-center">
                <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                    Welcome to ITASK
                </h3>

                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                    Sign in using your institutional account to access your projects,
                    committees, activities, and assigned tasks.
                </p>
            </div>

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
                        className="absolute right-3 top-8 text-slate-400 hover:text-slate-600 text-xs transition cursor-pointer select-none"
                        tabIndex={-1}
                    >
                        {showPassword ? 'Hide' : 'Show'}
                    </button>
                </div>

                <div className="flex items-center justify-between pt-1">
                    <Checkbox
                        label="Remember me"
                        checked={data.remember}
                        onChange={(e) => setData('remember', e.target.checked)}
                    />

                    <span className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer">
                        Forgot password?
                    </span>
                </div>

                <div className="pt-2">
                    <Button
                        type="submit"
                        variant="primary"
                        size="md"
                        isLoading={processing}
                        className="w-full justify-center font-semibold"
                    >
                        Sign In
                    </Button>
                </div>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-100 text-center">
                <p className="text-xs text-slate-600">
                    Don't have an ITASK account?{' '}
                    <Link
                        href="/register"
                        className="font-semibold text-[#F68233] hover:text-[#E06D1F] transition underline decoration-[#F68233]/40"
                    >
                        Register here
                    </Link>
                </p>
            </div>
        </GuestLayout>
    );
}