import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Views render inside the server process. React stays external so the server and its views share one renderer.
export default defineConfig({
    publicDir: false,
    resolve: { alias: { '~': resolve(__dirname, 'src') } },
    ssr: { noExternal: true },
    build: {
        ssr: 'src/entry-server.tsx',
        outDir: '../server/dist/ssr',
        emptyOutDir: true,
        target: 'node24',
        minify: false,
        rolldownOptions: {
            external: [/^react(?:-dom)?(?:\/.*)?$/],
            output: { entryFileNames: 'entry-server.js' }
        }
    }
});
