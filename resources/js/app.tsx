import '../css/app.css';

import { createInertiaApp } from '@inertiajs/react';
import { createRoot } from 'react-dom/client';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { TooltipProvider } from '@/Components/ui/tooltip';
import { ErrorBoundary } from '@/Components/ErrorBoundary';
import React from 'react';
import { configureEcho } from '@laravel/echo-react';

try {
    configureEcho({
        broadcaster: 'reverb',
    });
} catch (e) {
    console.warn('Echo initialization warning:', e);
}

const appName = import.meta.env.VITE_APP_NAME || 'ITASK';

createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    resolve: (name) =>
        resolvePageComponent(
            `./Pages/${name}.tsx`,
            import.meta.glob('./Pages/**/*.tsx'),
        ) as Promise<any>,
    setup({ el, App, props }) {
        if (el) {
            createRoot(el).render(
                <ErrorBoundary>
                    <TooltipProvider>
                        <App {...props} />
                    </TooltipProvider>
                </ErrorBoundary>,
            );
        }
    },
});
