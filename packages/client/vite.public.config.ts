import { fileURLToPath } from 'node:url';
import tailwind from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [tailwind()],
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
                fileURLToPath(new URL('./src/features/engagement/ui/comments-client.tsx', import.meta.url)),
                fileURLToPath(new URL('./src/application/screen-host/client.ts', import.meta.url)),
                fileURLToPath(new URL('./src/appearance/site-client.ts', import.meta.url))
            ]
        }
    }
});
