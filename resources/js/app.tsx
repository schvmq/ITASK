import '../css/app.css';

import { createInertiaApp } from '@inertiajs/react';
import { createRoot } from 'react-dom/client';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { TooltipProvider } from '@/Components/ui/tooltip';
import React from 'react';

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
                <TooltipProvider>
                    <App {...props} />
                </TooltipProvider>,
            );
        }
    },
});
