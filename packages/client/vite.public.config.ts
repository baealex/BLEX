import { fileURLToPath } from 'node:url';
import tailwind from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';
import babel from '@rolldown/plugin-babel';
import { lingui, linguiTransformerBabelPreset } from '@lingui/vite-plugin';

const compiledCatalog = /^\/\*eslint-disable\*\/export const messages=JSON\.parse\(("(?:[^"\\]|\\.)*")\);?$/s;
const publicMessage = (id: string) => id.startsWith('public.');

/**
 * Public pages translate only `ui()` copy, so their catalogs leave out the messages of React screens,
 * which load the full catalog from their own build. Public code that uses a dropped id fails the build.
 */
function publicCatalog(): Plugin {
    const dropped = new Set<string>();
    return {
        name: 'blex-public-catalog',
        enforce: 'post',
        transform: {
            filter: { id: /\.po$/ },
            handler(code, id) {
                const source = compiledCatalog.exec(code)?.[1];
                if (!source) this.error(`Unexpected compiled catalog format in ${id}`);
                const messages: Record<string, unknown> = JSON.parse(JSON.parse(source));
                for (const key of Object.keys(messages)) if (!publicMessage(key)) dropped.add(key);
                const kept = Object.fromEntries(Object.entries(messages).filter(([key]) => publicMessage(key)));
                return {
                    code: `export const messages=JSON.parse(${JSON.stringify(JSON.stringify(kept))});`,
                    map: null,
                    moduleType: 'js'
                };
            }
        },
        generateBundle(_, bundle) {
            for (const chunk of Object.values(bundle)) {
                if (chunk.type !== 'chunk') continue;
                const used = [...dropped].filter((key) =>
                    ['"', "'", '`'].some((q) => chunk.code.includes(q + key + q))
                );
                if (used.length > 0) {
                    this.error(
                        `${chunk.fileName} uses screen messages that public catalogs leave out: ${used.slice(0, 5).join(', ')}. Use ui() for public page copy.`
                    );
                }
            }
        }
    };
}

const authorPageEntries = [
    'author-overview-page',
    'author-posts-page',
    'author-series-page',
    'author-series-detail-page',
    'author-about-edit-page',
    'about-editor'
];

const contentPageEntries = [
    'discovery/static-page',
    'discovery/not-found-page',
    'discovery/forbidden-page',
    'developer-api/quickstart'
];

export default defineConfig({
    plugins: [tailwind(), lingui(), publicCatalog(), babel({ presets: [linguiTransformerBabelPreset()] })],
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
                // Separate entries keep their shared code out of the application entry, which must run only once.
                fileURLToPath(new URL('./src/features/auth/ui/login-page.tsx', import.meta.url)),
                fileURLToPath(new URL('./src/features/posts/post-page.tsx', import.meta.url)),
                fileURLToPath(new URL('./src/features/discovery/discovery-page.tsx', import.meta.url)),
                ...authorPageEntries.map((name) =>
                    fileURLToPath(new URL(`./src/features/authors/${name}.tsx`, import.meta.url))
                ),
                ...contentPageEntries.map((path) =>
                    fileURLToPath(new URL(`./src/features/${path}.tsx`, import.meta.url))
                ),
                fileURLToPath(new URL('./src/features/posts/code-blocks-client.ts', import.meta.url)),
                fileURLToPath(new URL('./src/application/screen-host/client.ts', import.meta.url)),
                fileURLToPath(new URL('./src/appearance/site-client.ts', import.meta.url))
            ]
        }
    }
});
