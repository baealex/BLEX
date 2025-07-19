import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
    const isDevelopment = mode === 'development';

    return {
        base: './',

        plugins: [react({ babel: { plugins: ['styled-jsx/babel'] } })],

        define: {
            'ISLAND': {
                'HOST_URL': process.env.SITE_URL,
                'STATIC_URL': process.env.STATIC_URL
            }
        },

        build: {
            outDir: '../../../static/islands',
            emptyOutDir: true,
            manifest: true,
            modulePreload: { polyfill: true },
            rollupOptions: {
                input: {
                    island: resolve(__dirname, 'src/island.tsx'),
                    mainStyle: resolve(__dirname, 'styles/main.scss'),
                    postStyle: resolve(__dirname, 'styles/post.scss'),
                    authorStyle: resolve(__dirname, 'styles/author.scss'),
                    settingStyle: resolve(__dirname, 'styles/setting.scss'),
                    editorStyle: resolve(__dirname, 'styles/editor.scss')
                },
                output: {
                    entryFileNames: '[name].[hash].js',
                    assetFileNames: '[name].[hash][extname]',
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
