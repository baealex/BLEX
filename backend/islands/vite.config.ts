import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { collectTemplateStyles } from './plugins/collect-template-styles';

export default defineConfig(({ mode }) => {
    const isDevelopment = mode === 'development';

    return {
        base: './',

        plugins: [
            ...(isDevelopment ? [] : [react()]),

            // 템플릿 디렉토리의 스타일 파일들 자동 수집
            collectTemplateStyles({
                templatesDir: '../src/board/templates/board',
                includePatterns: ['**/styles.scss', '**/components/*.scss']
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
            outDir: '../src/static/islands',
            emptyOutDir: true,
            manifest: true,
            modulePreload: { polyfill: true },
            rollupOptions: {
                input: {
                    island: resolve(__dirname, 'src/island.tsx'),
                    mainStyle: resolve(__dirname, 'styles/main.scss'),
                    postStyle: resolve(__dirname, 'styles/post.scss')
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
                '@templates': resolve(__dirname, '../src/board/templates')
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
