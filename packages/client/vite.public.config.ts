import { fileURLToPath } from 'node:url';
import tailwind from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import babel from '@rolldown/plugin-babel';
import { lingui, linguiTransformerBabelPreset } from '@lingui/vite-plugin';

export default defineConfig({
    plugins: [tailwind(), lingui(), babel({ presets: [linguiTransformerBabelPreset()] })],
    base: '/assets/ui/',
    publicDir: false,
    build: {
        outDir: '../server/dist/client',
        emptyOutDir: true,
        manifest: true,
        rolldownOptions: {
            preserveEntrySignatures: 'exports-only',
            input: [
                fileURLToPath(new URL('./src/application/client.tsx', import.meta.url)),
                fileURLToPath(new URL('./src/features/auth/ui/login-client.tsx', import.meta.url)),
                // Separate entries keep their shared code out of the application entry, which must run only once.
                fileURLToPath(new URL('./src/features/posts/post-page.tsx', import.meta.url)),
                fileURLToPath(new URL('./src/features/discovery/discovery-page.tsx', import.meta.url)),
                fileURLToPath(new URL('./src/features/posts/code-blocks-client.ts', import.meta.url)),
                fileURLToPath(new URL('./src/application/screen-host/client.ts', import.meta.url)),
                fileURLToPath(new URL('./src/appearance/site-client.ts', import.meta.url))
            ]
        }
    }
});
