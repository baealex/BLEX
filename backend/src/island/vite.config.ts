import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
    const isDevelopment = mode === 'development';

    return {
        plugins: [react()],
        build: {
            outDir: '../static/assets/island',
            emptyOutDir: true,
            rollupOptions: {
                input: {
                    hydrate: resolve(__dirname, 'src/hydrate.tsx'),
                },
                output: {
                    entryFileNames: '[name].bundle.js',
                    chunkFileNames: '[name].[hash].js',
                    assetFileNames: '[name].[ext]',
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
