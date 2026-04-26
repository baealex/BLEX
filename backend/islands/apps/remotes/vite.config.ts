import { defineConfig, type Plugin, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { visualizer } from 'rollup-plugin-visualizer';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';

const DEFAULT_DEV_SERVER_PORT = 8100;
const DEV_SERVER_HOST = process.env.VITE_DEV_SERVER_HOST || 'localhost';
const DEV_SERVER_INFO_PATH = process.env.VITE_DEV_SERVER_INFO_PATH
    || resolve(__dirname, '../../../src/resources/staticfiles/islands/.vite/dev-server.json');

const getDevServerPort = () => {
    const rawPort = process.env.VITE_DEV_SERVER_PORT;
    if (!rawPort) return DEFAULT_DEV_SERVER_PORT;

    const port = Number.parseInt(rawPort, 10);
    return Number.isInteger(port) && port > 0 ? port : DEFAULT_DEV_SERVER_PORT;
};

const writeDevServerInfoPlugin = (): Plugin => ({
    name: 'blex-dev-server-info',
    configureServer(server: ViteDevServer) {
        const writeDevServerInfo = () => {
            const address = server.httpServer?.address();
            const port = typeof address === 'object' && address ? address.port : getDevServerPort();
            const protocol = server.config.server.https ? 'https' : 'http';
            const url = `${protocol}://${DEV_SERVER_HOST}:${port}`;

            mkdirSync(dirname(DEV_SERVER_INFO_PATH), { recursive: true });
            writeFileSync(
                DEV_SERVER_INFO_PATH,
                JSON.stringify({ url, host: DEV_SERVER_HOST, port, protocol }, null, 2)
            );
        };

        const removeDevServerInfo = () => {
            if (existsSync(DEV_SERVER_INFO_PATH)) {
                rmSync(DEV_SERVER_INFO_PATH, { force: true });
            }
        };

        removeDevServerInfo();
        server.httpServer?.once('listening', writeDevServerInfo);
        server.httpServer?.once('close', removeDevServerInfo);
    }
});

export default defineConfig(({ mode }) => {
    const isDevelopment = mode === 'development';

    return {
        base: './',

        plugins: [
            writeDevServerInfoPlugin(),
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
            port: getDevServerPort(),
            host: true,
            cors: true,
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
