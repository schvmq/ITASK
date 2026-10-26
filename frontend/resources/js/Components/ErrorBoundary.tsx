import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from './Button';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
    }

    private handleReset = () => {
        this.setState({ hasError: false, error: null });
        window.location.reload();
    };

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="min-h-[360px] flex items-center justify-center p-6 text-center">
                    <div className="max-w-md w-full bg-[color:var(--card)] border border-[color:var(--border)] rounded-[12px] p-6 text-[color:var(--text)]">
                        <div className="w-12 h-12 mx-auto rounded-full bg-[color:var(--status-danger-bg)] border border-[color:var(--status-danger-border)] flex items-center justify-center text-[color:var(--primary)] mb-4">
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                        <h2 className="text-[18px] font-bold text-[color:var(--text)] mb-2">Something went wrong</h2>
                        <p className="text-[14px] text-[color:var(--muted)] mb-5">
                            An unexpected interface error occurred. Your data is safe. Try refreshing the view.
                        </p>
                        <div className="flex items-center justify-center gap-3">
                            <Button
                                variant="primary"
                                onClick={this.handleReset}
                                leftIcon={<RotateCcw className="w-4 h-4" />}
                            >
                                Try again
                            </Button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
