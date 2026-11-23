import { defineConfig } from 'vite';
import babel from '@rolldown/plugin-babel';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { lingui, linguiTransformerBabelPreset } from '@lingui/vite-plugin';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import { visualizer } from 'rollup-plugin-visualizer';
import { resolve } from 'node:path';

const DEFAULT_DEV_SERVER_PORT = 8100;
const getDevServerPort = () => {
    const rawPort = process.env.VITE_DEV_SERVER_PORT;
    if (!rawPort) return DEFAULT_DEV_SERVER_PORT;

    const port = Number.parseInt(rawPort, 10);
    return Number.isInteger(port) && port > 0 ? port : DEFAULT_DEV_SERVER_PORT;
};

export default defineConfig({
    base: './',

    plugins: [
        tanstackRouter({
            target: 'react',
            routesDirectory: resolve(import.meta.dirname, 'src/routes'),
            generatedRouteTree: resolve(import.meta.dirname, 'src/routeTree.gen.ts'),
            quoteStyle: 'single',
            semicolons: true,
            routeFileIgnorePattern: '\\.page\\.tsx$'
        }),
        react(),
        lingui(),
        babel({
            presets: [
                // Keep mutable shared UI and editor state outside the React Compiler transform.
                reactCompilerPreset({
                    sources: (filename: string) => !/\/src\/(?:ui|features\/editor\/tiptap)\//.test(filename)
                }),
                linguiTransformerBabelPreset()
            ]
        }),
        visualizer({
            filename: 'stats.html',
            open: false,
            gzipSize: true
        })
    ],

    server: {
        port: getDevServerPort(),
        host: true,
        cors: true,
        hmr: true
    },

    build: {
        outDir: '../server/dist/web',
        emptyOutDir: true,
        manifest: true,
        modulePreload: { polyfill: true },
        rolldownOptions: {
            // Shared UI and editor modules stay side-effect free, so importing one export never pulls in Tiptap.
            treeshake: {
                moduleSideEffects: (id: string) =>
                    /\/src\/(?:ui|features\/editor\/tiptap)\//.test(id) ? false : undefined
            },
            input: {
                screenRuntime: resolve(import.meta.dirname, 'src/screen-runtime.tsx'),
                mainStyle: resolve(import.meta.dirname, 'styles/main.scss'),
                screenLoader: resolve(import.meta.dirname, 'src/scripts/screen-loader.ts')
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
            '~': resolve(import.meta.dirname, 'src')
        }
    }
});
