import React, { useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import { GuestLayout } from '@/Layouts/GuestLayout';
import { Button, FormField, Checkbox, Alert } from '@/Components';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [remember, setRemember] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setErrors({});

        // Client-side institutional validation preview
        const newErrors: Record<string, string> = {};
        if (!email) {
            newErrors.email = 'Institutional email is required.';
        } else if (!email.endsWith('@carsu.edu.ph')) {
            newErrors.email = 'Please use your official @carsu.edu.ph institutional email.';
        }

        if (!password) {
            newErrors.password = 'Password is required.';
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
            title="Sign in to ITASK"
            subtitle="Faculty Workflow Coordination System — CCIS"
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
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="username@carsu.edu.ph"
                    required
                    error={errors.email}
                    helperText="Must be your official university email"
                    autoComplete="username"
                    autoFocus
                />

                <div className="relative">
                    <FormField
                        label="Password"
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        error={errors.password}
                        autoComplete="current-password"
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-8 text-slate-400 hover:text-slate-600 text-xs transition cursor-pointer"
                        tabIndex={-1}
                    >
                        {showPassword ? 'Hide' : 'Show'}
                    </button>
                </div>

                <div className="flex items-center justify-between pt-1">
                    <Checkbox
                        label="Remember this device"
                        checked={remember}
                        onChange={(e) => setRemember(e.target.checked)}
                    />
                    <span className="text-xs text-slate-400">
                        Forgot password?
                    </span>
                </div>

                <div className="pt-2">
                    <Button
                        type="submit"
                        variant="primary"
                        size="md"
                        isLoading={isLoading}
                        className="w-full justify-center"
                    >
                        Sign In to Workspace
                    </Button>
                </div>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-100 text-center">
                <p className="text-xs text-slate-600">
                    New faculty member?{' '}
                    <Link
                        href="/register"
                        className="font-semibold text-[#F68233] hover:text-[#E06D1F] transition underline decoration-[#F68233]/40"
                    >
                        Register an account
                    </Link>
                </p>
            </div>
        </GuestLayout>
    );
}
