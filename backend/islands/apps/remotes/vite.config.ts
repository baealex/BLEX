import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
    const isDevelopment = mode === 'development';

    return {
        base: './',

        plugins: [
            tailwindcss(),
            ...(isDevelopment ? [] : [react()])
        ],

        server: {
            port: 5173,
            host: true,
            cors: true,
            origin: 'http://localhost:5173',
            hmr: true
        },

        build: {
            outDir: '../../../src/resources/staticfiles/islands',
            emptyOutDir: true,
            manifest: true,
            modulePreload: { polyfill: true },
            rollupOptions: {
                input: {
                    island: resolve(__dirname, 'src/island.tsx'),
                    mainStyle: resolve(__dirname, 'styles/main.scss'),
                    tailwindStyle: resolve(__dirname, 'styles/tailwind.css'),
                    postStyle: resolve(__dirname, 'styles/post.scss'),
                    lazyLoading: resolve(__dirname, 'src/scripts/lazy-loading.ts'),
                    alpineLoader: resolve(__dirname, 'src/scripts/alpine-loader.ts'),
                    syntaxHighlighting: resolve(__dirname, 'src/scripts/syntax-highlighting.ts')
                },
                output: {
                    entryFileNames: '[name].[hash].js',
                    assetFileNames: '[name].[hash][extname]',
                    chunkFileNames: 'chunks/[name].[hash].js'
                }
            }
        },

        resolve: {
            alias: {
                '~': resolve(__dirname, 'src'),
                '@templates': resolve(__dirname, '../../../src/board/templates')
            }
        },

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
