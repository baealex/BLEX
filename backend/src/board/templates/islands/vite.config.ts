import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
    const isDevelopment = mode === 'development';

    return {
        plugins: [react({
            babel: {
                plugins: ['styled-jsx/babel']
            }
        })],
        build: {
            outDir: '../../../static/assets/modules',
            emptyOutDir: true,
            // Enable module splitting for better code chunking
            modulePreload: {
                polyfill: true,
            },
            // Configure code splitting
            rollupOptions: {
                input: {
                    island: resolve(__dirname, 'src/island.tsx'),
                    mainStyles: resolve(__dirname, 'styles/main.scss'),
                    authorStyles: resolve(__dirname, 'styles/author.scss'),
                },
                output: {
                    entryFileNames: '[name].bundle.js',
                    chunkFileNames: 'chunks/[name].[hash].js',
                    assetFileNames: '[name].[ext]',
                    // Ensure chunks are properly loaded
                    manualChunks: (id) => {
                        // Group component chunks by their directory
                        if (id.includes('/components/')) {
                            const component = id.split('/components/')[1].split('/')[0];
                            return `component-${component}`;
                        }
                    },
                },
            },
        },
        resolve: {
            alias: {
                '~': resolve(__dirname, 'src'),
            },
        },
        css: {
            modules: {
                localsConvention: 'camelCase',
                generateScopedName: isDevelopment
                    ? '[name]__[local]--[hash:base64:5]'
                    : '[hash:base64:8]',
            },
        },
    };
});
