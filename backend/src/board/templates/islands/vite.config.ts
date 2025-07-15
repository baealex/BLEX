import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
    const isDevelopment = mode === 'development';
    const normalizedStaticUrl = process.env.STATIC_URL.endsWith('/') ? process.env.STATIC_URL.slice(0, -1) : process.env.STATIC_URL;
    const base = normalizedStaticUrl + '/';

    return {
        base,
        plugins: [react({ babel: { plugins: ['styled-jsx/babel'] } })],
        build: {
            outDir: '../../../static/islands',
            emptyOutDir: true,
            manifest: true,
            modulePreload: { polyfill: true },
            rollupOptions: {
                input: [
                    resolve(__dirname, 'src/island.tsx'),
                    resolve(__dirname, 'styles/main.scss'),
                    resolve(__dirname, 'styles/author.scss'),
                    resolve(__dirname, 'styles/setting.scss'),
                    resolve(__dirname, 'styles/editor.scss')
                ],
                output: {
                    entryFileNames: '[name].[hash].bundle.js',
                    assetFileNames: 'assets/[name].[hash][extname]',
                    chunkFileNames: 'chunks/[name].[hash].js'
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
