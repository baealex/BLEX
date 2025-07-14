import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
    const isDevelopment = mode === 'development';

    return {
        // 개발 모드와 프로덕션 모드에 따라 base URL 설정
        base: isDevelopment ? 'http://localhost:8080/' : '/static/islands/',
        plugins: [react({ babel: { plugins: ['styled-jsx/babel'] } })],
        build: {
            outDir: '../../../static/islands',
            emptyOutDir: true,
            manifest: true, // Generate manifest.json file
            // Enable module splitting for better code chunking
            modulePreload: { polyfill: true },
            // Configure code splitting
            rollupOptions: {
                input: {
                    island: resolve(__dirname, 'src/island.tsx'),
                    mainStyles: resolve(__dirname, 'styles/main.scss'),
                    authorStyles: resolve(__dirname, 'styles/author.scss'),
                    settingStyles: resolve(__dirname, 'styles/setting.scss'),
                    editorStyles: resolve(__dirname, 'styles/editor.scss')
                },
                output: {
                    entryFileNames: '[name].[hash].bundle.js',
                    chunkFileNames: 'chunks/[name].[hash].js',
                    // Ensure chunks are properly loaded
                    manualChunks: (id) => {
                        // Group component chunks by their directory
                        if (id.includes('/components/')) {
                            const component = id.split('/components/')[1].split('/')[0];
                            return `component-${component}`;
                        }
                    }
                }
            }
        },
        resolve: { alias: { '~': resolve(__dirname, 'src') } },
        css: {
            modules: {
                localsConvention: 'camelCase',
                generateScopedName: isDevelopment
                    ? '[name]__[local]--[hash:base64:5]'
                    : '[hash:base64:8]'
            }
        }
    };
});
