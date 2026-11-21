import { fileURLToPath } from 'node:url';
import tailwind from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tailwind()],
  base: '/assets/ui/',
  publicDir: false,
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
    manifest: true,
    rollupOptions: {
      preserveEntrySignatures: 'exports-only',
      input: [
        fileURLToPath(new URL('./src/application/client.tsx', import.meta.url)),
        fileURLToPath(new URL('./src/auth-ui/login-client.tsx', import.meta.url)),
        fileURLToPath(new URL('./src/authoring-ui/editor-client.tsx', import.meta.url)),
        fileURLToPath(new URL('./src/reader-ui/comments-client.tsx', import.meta.url)),
        fileURLToPath(new URL('./src/appearance/site-client.ts', import.meta.url)),
      ],
    },
  },
});
