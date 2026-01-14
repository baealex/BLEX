import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { visualizer } from 'rollup-plugin-visualizer';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
    const isDevelopment = mode === 'development';

    return {
        base: './',

        plugins: [
            tailwindcss(),
            react({
                babel: {
                    plugins: [
                        ['babel-plugin-react-compiler', {}]
                    ]
                }
            }),
            visualizer({
                filename: 'stats.html',
                open: false,
                gzipSize: true
            })
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
                    chunkFileNames: 'chunks/[name].[hash].js',
                    manualChunks: (id) => {
                        // React core - shared across all components
                        if (id.includes('react-dom') || id.includes('node_modules/react/')) {
                            return 'react-vendor';
                        }

                        // Tiptap editor - only used by PostEditor (doesn't need React at init)
                        if (id.includes('@tiptap') || id.includes('prosemirror')) {
                            return 'tiptap';
                        }

                        // Zod - pure JS, no React dependency
                        if (id.includes('/zod')) {
                            return 'zod';
                        }

                        // Highlight.js & lowlight - pure JS, no React dependency
                        if (id.includes('highlight.js') || id.includes('lowlight')) {
                            return 'highlight';
                        }
                    }
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
