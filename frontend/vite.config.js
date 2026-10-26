import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

import fs from 'fs';

function laravelHotFilePlugin() {
    return {
        name: 'laravel-hot-file',
        configureServer(server) {
            const hotPath = path.resolve(__dirname, '../backend/public/hot');
            try {
                fs.writeFileSync(hotPath, 'http://localhost:5173');
            } catch (e) {}

            const cleanup = () => {
                try {
                    if (fs.existsSync(hotPath)) {
                        fs.unlinkSync(hotPath);
                    }
                } catch (e) {}
            };
            process.on('exit', cleanup);
            process.on('SIGINT', cleanup);
            process.on('SIGTERM', cleanup);
        },
    };
}

export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
        laravelHotFilePlugin(),
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './resources/js'),
            '@/components': path.resolve(__dirname, './resources/js/Components'),
        },
    },
    build: {
        outDir: path.resolve(__dirname, '../backend/public/build'),
        emptyOutDir: true,
        manifest: 'manifest.json',
        rollupOptions: {
            input: [
                path.resolve(__dirname, 'resources/css/app.css'),
                path.resolve(__dirname, 'resources/js/app.tsx'),
            ],
        },
    },
    server: {
        host: 'localhost',
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://127.0.0.1:8000',
                changeOrigin: true,
                secure: false,
            },
            '/chat': {
                target: 'http://127.0.0.1:8000',
                changeOrigin: true,
                secure: false,
            },
            '/messages': {
                target: 'http://127.0.0.1:8000',
                changeOrigin: true,
                secure: false,
            },
            '/broadcasting': {
                target: 'http://127.0.0.1:8000',
                changeOrigin: true,
                secure: false,
            },
            '/sanctum': {
                target: 'http://127.0.0.1:8000',
                changeOrigin: true,
                secure: false,
            },
        },
    },
});
