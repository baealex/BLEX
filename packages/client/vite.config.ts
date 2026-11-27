import { resolve } from 'node:path';
import tailwind from '@tailwindcss/vite';
import { build, defineConfig, type InlineConfig, type Plugin, type Rolldown } from 'vite';
import babel from '@rolldown/plugin-babel';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { lingui, linguiTransformerBabelPreset } from '@lingui/vite-plugin';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import { visualizer } from 'rollup-plugin-visualizer';

const DEFAULT_DEV_SERVER_PORT = 8100;
const getDevServerPort = () => {
    const rawPort = process.env.VITE_DEV_SERVER_PORT;
    if (!rawPort) return DEFAULT_DEV_SERVER_PORT;

    const port = Number.parseInt(rawPort, 10);
    return Number.isInteger(port) && port > 0 ? port : DEFAULT_DEV_SERVER_PORT;
};

const source = (path: string) => resolve(import.meta.dirname, path);

const authorPageEntries = [
    'author-overview-page',
    'author-posts-page',
    'author-series-page',
    'author-series-detail-page',
    'author-about-edit-page',
    'about-editor'
];

const workLogPageEntries = ['index-page', 'detail-page', 'delete-page', 'shared-page'];

const contentPageEntries = [
    'discovery/search-page',
    'discovery/static-page',
    'discovery/not-found-page',
    'discovery/forbidden-page',
    'developer-api/quickstart',
    'posts/revisions-page',
    'posts/timelapse-page',
    'posts/share-links-page'
];

const authFormPageEntries = ['signup-page', 'setup-page', 'reauthenticate-page', 'password-reset-page'];

const publicEntries = [
    source('src/application/client.tsx'),
    // Separate entries keep their shared code out of the application entry, which must run only once.
    source('src/features/auth/ui/login-page.tsx'),
    ...authFormPageEntries.map((name) => source(`src/features/auth/ui/${name}.tsx`)),
    source('src/features/posts/post-page.tsx'),
    source('src/features/discovery/discovery-page.tsx'),
    ...authorPageEntries.map((name) => source(`src/features/authors/${name}.tsx`)),
    ...workLogPageEntries.map((name) => source(`src/features/work-logs/${name}.tsx`)),
    ...contentPageEntries.map((path) => source(`src/features/${path}.tsx`)),
    source('src/features/posts/code-blocks-client.ts'),
    source('src/appearance/site-client.ts')
];

// The application imports the screen runtime only when a page holds a screen. It brings the screens,
// their catalogs, and React Compiler output, so public pages stop at it.
const screenEntries = [source('src/screen-runtime.tsx')];

// Pretendard Variable's dynamic subset from the `pretendard` package 1.3.9, copied as published. The server serves it
// at /assets/blex/fonts.css, apart from the site styles, so it stays cached while those change.
const siteFontEntry = 'styles/fonts/pretendard/pretendardvariable-dynamic-subset.css';

// Public pages run without React Compiler output, so their modules stay outside it.
// Mutable shared UI and editor state stay outside it as well.
const publicSources =
    /\/src\/(?:application|appearance|i18n|features\/(?:auth\/ui|authors|developer-api|discovery|engagement|posts|work-logs))\//;
const uncompiledSources = /\/src\/(?:ui|features\/editor\/tiptap)\//;

const compiledCatalog = /^\/\*eslint-disable\*\/export const messages=JSON\.parse\(("(?:[^"\\]|\\.)*")\);?$/s;
type CatalogPart = 'public' | 'developer' | 'screen';
const catalogPart = (key: string): CatalogPart =>
    key.startsWith('public.') ? 'public' : key.startsWith('developer.') ? 'developer' : 'screen';
const catalogModulePart = (id: string): CatalogPart =>
    id.endsWith('?developer?lingui') ? 'developer' : id.endsWith('?lingui') ? 'screen' : 'public';

/**
 * `messages.po` gives public pages only their `public.` messages, and `messages.po?lingui`, the same
 * catalog under another module id, gives screens the rest. `messages.po?developer?lingui` holds the
 * Developer API guide's `developer.` messages, which only the guide loads. Code that public pages load before
 * the screen runtime must not use a screen message, reach the screen catalogs, or carry React Compiler output.
 */
function splitCatalogs(): Plugin {
    const screenMessages = new Set<string>();
    return {
        name: 'blex-split-catalogs',
        enforce: 'post',
        transform: {
            filter: { id: /\.po(?:(?:\?developer)?\?lingui)?$/ },
            handler(code, id) {
                const catalog = compiledCatalog.exec(code)?.[1];
                if (!catalog) this.error(`Unexpected compiled catalog format in ${id}`);
                const messages: Record<string, unknown> = JSON.parse(JSON.parse(catalog));
                const part = catalogModulePart(id);
                for (const key of Object.keys(messages)) if (catalogPart(key) === 'screen') screenMessages.add(key);
                const kept = Object.fromEntries(Object.entries(messages).filter(([key]) => catalogPart(key) === part));
                return {
                    code: `export const messages=JSON.parse(${JSON.stringify(JSON.stringify(kept))});`,
                    map: null,
                    moduleType: 'js'
                };
            }
        },
        generateBundle(_, bundle) {
            const chunks = new Map(
                Object.values(bundle).flatMap((item) => (item.type === 'chunk' ? [[item.fileName, item]] : []))
            );
            const pending = [...chunks.values()].filter(
                (chunk) => chunk.isEntry && publicEntries.includes(chunk.facadeModuleId ?? '')
            );
            const publicChunks = new Set(pending);
            for (const chunk of pending) {
                for (const file of [...chunk.imports, ...chunk.dynamicImports]) {
                    const imported = chunks.get(file);
                    if (imported && screenEntries.includes(imported.facadeModuleId ?? '')) continue;
                    if (imported && !publicChunks.has(imported)) {
                        publicChunks.add(imported);
                        pending.push(imported);
                    }
                }
            }
            for (const chunk of publicChunks) {
                const used = [...screenMessages].filter((key) =>
                    ['"', "'", '`'].some((q) => chunk.code.includes(q + key + q))
                );
                if (used.length > 0) {
                    this.error(
                        `${chunk.fileName} loads on public pages but uses screen messages: ${used.slice(0, 5).join(', ')}. Use ui() for public page copy.`
                    );
                }
                const screenOnly = chunk.moduleIds.filter(
                    (id) => id.endsWith('.po?lingui') || /\/react\/compiler-runtime\.js$/.test(id)
                );
                if (screenOnly.length > 0) {
                    this.error(
                        `${chunk.fileName} loads on public pages but includes screen code: ${screenOnly.join(', ')}.`
                    );
                }
            }
        }
    };
}

const browserPlugins = () => [
    tailwind(),
    react(),
    lingui(),
    splitCatalogs(),
    babel({
        presets: [
            reactCompilerPreset({
                sources: (filename: string) => !uncompiledSources.test(filename) && !publicSources.test(filename)
            }),
            linguiTransformerBabelPreset()
        ]
    })
];

const browserBuild = {
    base: '/assets/ui/',
    publicDir: false,
    resolve: { alias: { '~': source('src') } }
} satisfies InlineConfig;

// Shared UI and editor modules stay side-effect free, so importing one export never pulls in Tiptap.
const treeshake = {
    moduleSideEffects: (id: string) => (uncompiledSources.test(id) ? false : undefined)
};

interface PublicChunk {
    /** The group that keeps the chunk's modules together, or, for an owned chunk, the group its shared modules move to. */
    name: string;
    /** The page entry or lazy module that owns the chunk, which no other chunk takes modules from. */
    owner: string | null;
}

/** Bundles the public entries alone, as if screens did not exist, and records each module's chunk. */
async function bundlePublicEntries(): Promise<Map<string, PublicChunk>> {
    const result = await build({
        ...browserBuild,
        configFile: false,
        root: import.meta.dirname,
        logLevel: 'silent',
        plugins: browserPlugins(),
        build: {
            write: false,
            rolldownOptions: {
                input: publicEntries,
                // The application's import of the screen runtime stays an import, so no screen code is bundled.
                external: (id) => screenEntries.includes(id.replace(/\?.*$/, '')),
                preserveEntrySignatures: 'exports-only',
                treeshake
            }
        }
    });
    const outputs = (Array.isArray(result) ? result : [result]) as Rolldown.RolldownOutput[];
    const names = new Set<string>();
    const chunks = new Map<string, PublicChunk>();
    for (const chunk of outputs.flatMap(({ output }) => output)) {
        if (chunk.type !== 'chunk') continue;
        if (chunk.moduleIds.some((id) => screenEntries.includes(id)))
            throw new Error(`The public pages were bundled with the screen runtime in ${chunk.fileName}.`);
        const owner = chunk.isEntry || chunk.isDynamicEntry ? chunk.facadeModuleId : null;
        // Each distinct name becomes one chunk, so two public chunks never share a name.
        let name = owner
            ? `${owner
                  .replace(/^.*\/(?:src|node_modules)\//, '')
                  .replace(/\.[^/]*$/, '')
                  .replace(/[^\w-]+/g, '-')}-shared`
            : chunk.name;
        for (let index = 2; names.has(name); index += 1) name = `${chunk.name}${index}`;
        names.add(name);
        for (const id of chunk.moduleIds) chunks.set(id, { name, owner });
    }
    return chunks;
}

interface ModuleGraph {
    getModuleInfo(id: string): { importedIds: readonly string[]; dynamicallyImportedIds: readonly string[] } | null;
}

/**
 * Screens import a few modules from many public chunks. Split as usual, those chunks would break into
 * pieces for public pages too, so every module that public pages load keeps the chunk it has without
 * screens. A module that a page entry or lazy module owns moves to one shared chunk beside it when screens
 * use it too, because the application entry loads through a redirecting alias and must not be imported.
 */
function keepPublicChunks(publicChunks: Map<string, PublicChunk>, graph: ModuleGraph) {
    const screenModules = new Set<string>();
    const pending = [...screenEntries];
    for (const id of pending) {
        if (screenModules.has(id)) continue;
        screenModules.add(id);
        const info = graph.getModuleInfo(id);
        pending.push(...(info?.importedIds ?? []), ...(info?.dynamicallyImportedIds ?? []));
    }
    return (id: string): string | null => {
        const chunk = publicChunks.get(id);
        if (!chunk || id.startsWith('\0') || /\.s?css(?:\?|$)/.test(id)) return null;
        if (!chunk.owner) return chunk.name;
        return chunk.owner !== id && screenModules.has(id) ? chunk.name : null;
    };
}

let publicChunks: Map<string, PublicChunk> | undefined;
let publicChunkName: ReturnType<typeof keepPublicChunks> | undefined;

function readPublicChunks(): Plugin {
    return {
        name: 'blex-public-chunks',
        apply: 'build',
        async buildStart() {
            publicChunks = await bundlePublicEntries();
            publicChunkName = undefined;
        }
    };
}

export default defineConfig({
    ...browserBuild,

    plugins: [
        tanstackRouter({
            target: 'react',
            routesDirectory: source('src/routes'),
            generatedRouteTree: source('src/routeTree.gen.ts'),
            quoteStyle: 'single',
            semicolons: true,
            routeFileIgnorePattern: '\\.page\\.tsx$'
        }),
        readPublicChunks(),
        ...browserPlugins(),
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
        outDir: '../server/dist/client',
        emptyOutDir: true,
        manifest: true,
        rolldownOptions: {
            // Grouping only the captured modules needs entries that may gain exports.
            preserveEntrySignatures: 'allow-extension',
            treeshake,
            input: [...publicEntries, source('styles/main.scss'), source(siteFontEntry)],
            output: {
                codeSplitting: {
                    includeDependenciesRecursively: false,
                    groups: [
                        {
                            name: (id, graph) => {
                                if (!publicChunks) throw new Error('The public chunks were not bundled first.');
                                publicChunkName ??= keepPublicChunks(publicChunks, graph);
                                return publicChunkName(id);
                            }
                        }
                    ]
                }
            }
        }
    }
});
