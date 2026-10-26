import '../css/app.css';

import { createInertiaApp } from '@inertiajs/react';
import { createRoot } from 'react-dom/client';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { TooltipProvider } from '@/Components/ui/tooltip';
import { ErrorBoundary } from '@/Components/ErrorBoundary';
import './bootstrap';
import axios from 'axios';
import { configureEcho } from '@laravel/echo-react';

try {
    const reverbKey = import.meta.env.VITE_REVERB_APP_KEY || 'r5tqwkfivdusr1wmo7oc';
    const rawHost = import.meta.env.VITE_REVERB_HOST || (typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1');
    const wsHost = rawHost === 'localhost' ? '127.0.0.1' : rawHost;
    const wsPort = import.meta.env.VITE_REVERB_PORT ? Number(import.meta.env.VITE_REVERB_PORT) : 8081;
    const isHttps = (import.meta.env.VITE_REVERB_SCHEME || 'http') === 'https';

    configureEcho({
        broadcaster: 'reverb',
        key: reverbKey,
        wsHost: wsHost,
        wsPort: wsPort,
        wssPort: wsPort,
        forceTLS: isHttps,
        enabledTransports: ['ws', 'wss'],
        authorizer: (channel: any) => ({
            authorize: (socketId: string, callback: (error: any, authData: any) => void) => {
                axios
                    .post(
                        '/broadcasting/auth',
                        {
                            socket_id: socketId,
                            channel_name: channel.name,
                        },
                        {
                            headers: {
                                Accept: 'application/json',
                                'X-Requested-With': 'XMLHttpRequest',
                            },
                            withCredentials: true,
                        }
                    )
                    .then((response) => {
                        callback(null, response.data);
                    })
                    .catch((error) => {
                        console.error('Broadcasting channel authorization failed:', error);
                        callback(error, null);
                    });
            },
        }),
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
