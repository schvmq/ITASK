import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import '@/../css/app.css';
import { api, UserProfile } from './lib/api';
import { Button } from './Components/Button';
import { FormField } from './Components/FormField';
import { Checkbox } from './Components/Checkbox';
import { Alert } from './Components/Alert';

function StandaloneAuthApp() {
    const [view, setView] = useState<'login' | 'register' | 'profile'>('login');
    const [user, setUser] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Form states
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [passwordConfirmation, setPasswordConfirmation] = useState('');
    const [remember, setRemember] = useState(false);

    useEffect(() => {
        // Check session on load
        api.auth.me()
            .then((res) => {
                if (res?.user) {
                    setUser(res.user);
                    setView('profile');
                }
            })
            .catch(() => {
                // Guest state
            });
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage(null);
        setStatusMessage(null);
        setLoading(true);

        try {
            const res = await api.auth.login({ email, password, remember });
            setStatusMessage(res.message);
            if (res.user) {
                setUser(res.user);
                setView('profile');
            }
        } catch (err: any) {
            const msg = err.response?.data?.errors?.email?.[0] || err.response?.data?.message || 'Login failed. Please verify credentials.';
            setErrorMessage(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage(null);
        setStatusMessage(null);
        setLoading(true);

        try {
            const res = await api.auth.register({
                name,
                email,
                password,
                password_confirmation: passwordConfirmation,
            });
            setStatusMessage(res.message);
            if (res.user) {
                setUser(res.user);
                setView('profile');
            }
        } catch (err: any) {
            const msg = err.response?.data?.errors?.email?.[0] || err.response?.data?.message || 'Registration failed.';
            setErrorMessage(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        setLoading(true);
        try {
            await api.auth.logout();
            setUser(null);
            setView('login');
            setStatusMessage('You have been logged out.');
        } catch (err: any) {
            setErrorMessage('Logout error.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col justify-center items-center px-4 py-12 bg-[color:var(--background)]">
            <div className="w-full max-w-md p-8 bg-[color:var(--card)] border border-[color:var(--border)] rounded-2xl shadow-sm">
                <div className="mb-6 text-center">
                    <h1 className="text-2xl font-bold tracking-tight text-[color:var(--text)]">ITASK Decoupled UI</h1>
                    <p className="text-sm text-[color:var(--muted)] mt-1">CarSU Academic Project & Deliverables Hub</p>
                </div>

                {statusMessage && (
                    <Alert variant="info" className="mb-4">
                        {statusMessage}
                    </Alert>
                )}

                {errorMessage && (
                    <Alert variant="danger" className="mb-4">
                        {errorMessage}
                    </Alert>
                )}

                {view === 'profile' && user ? (
                    <div className="space-y-4">
                        <div className="p-4 bg-[color:var(--soft-surface)] rounded-xl border border-[color:var(--border)] space-y-2">
                            <p className="text-sm font-semibold text-[color:var(--text)]">{user.name}</p>
                            <p className="text-xs font-mono text-[color:var(--muted)]">{user.email}</p>
                            <div className="flex gap-2 pt-2">
                                <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300">
                                    {user.primaryRole || 'Member'}
                                </span>
                                {user.is_admin && (
                                    <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300">
                                        Administrator
                                    </span>
                                )}
                            </div>
                        </div>

                        <Button
                            variant="secondary"
                            className="w-full"
                            onClick={handleLogout}
                            disabled={loading}
                        >
                            {loading ? 'Signing out...' : 'Sign Out'}
                        </Button>
                    </div>
                ) : view === 'login' ? (
                    <form onSubmit={handleLogin} className="space-y-4">
                        <FormField label="Institutional Email (@carsu.edu.ph)" required>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="username@carsu.edu.ph"
                                required
                                className="w-full px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--text)] focus:ring-2 focus:ring-orange-500 outline-none"
                            />
                        </FormField>

                        <FormField label="Password" required>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                className="w-full px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--text)] focus:ring-2 focus:ring-orange-500 outline-none"
                            />
                        </FormField>

                        <div className="flex items-center justify-between text-xs">
                            <Checkbox
                                label="Remember me"
                                checked={remember}
                                onChange={(e) => setRemember(e.target.checked)}
                            />
                        </div>

                        <Button type="submit" variant="primary" className="w-full" disabled={loading}>
                            {loading ? 'Authenticating...' : 'Sign In'}
                        </Button>

                        <div className="pt-2 text-center text-xs text-[color:var(--muted)]">
                            Don't have an account?{' '}
                            <button
                                type="button"
                                onClick={() => { setView('register'); setErrorMessage(null); }}
                                className="text-orange-600 hover:underline font-semibold"
                            >
                                Register
                            </button>
                        </div>
                    </form>
                ) : (
                    <form onSubmit={handleRegister} className="space-y-4">
                        <FormField label="Full Name" required>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Juan Dela Cruz"
                                required
                                className="w-full px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--text)] focus:ring-2 focus:ring-orange-500 outline-none"
                            />
                        </FormField>

                        <FormField label="Institutional Email (@carsu.edu.ph)" required>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="juan.delacruz@carsu.edu.ph"
                                required
                                className="w-full px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--text)] focus:ring-2 focus:ring-orange-500 outline-none"
                            />
                        </FormField>

                        <FormField label="Password" required>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Minimum 8 characters"
                                required
                                className="w-full px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--text)] focus:ring-2 focus:ring-orange-500 outline-none"
                            />
                        </FormField>

                        <FormField label="Confirm Password" required>
                            <input
                                type="password"
                                value={passwordConfirmation}
                                onChange={(e) => setPasswordConfirmation(e.target.value)}
                                placeholder="Re-enter password"
                                required
                                className="w-full px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--text)] focus:ring-2 focus:ring-orange-500 outline-none"
                            />
                        </FormField>

                        <Button type="submit" variant="primary" className="w-full" disabled={loading}>
                            {loading ? 'Creating Account...' : 'Register'}
                        </Button>

                        <div className="pt-2 text-center text-xs text-[color:var(--muted)]">
                            Already registered?{' '}
                            <button
                                type="button"
                                onClick={() => { setView('login'); setErrorMessage(null); }}
                                className="text-orange-600 hover:underline font-semibold"
                            >
                                Sign In
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

const container = document.getElementById('app');
if (container) {
    createRoot(container).render(<StandaloneAuthApp />);
}
