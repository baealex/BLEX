import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const currentDir = dirname(fileURLToPath(import.meta.url));

const readBuild = () => {
    const outDir = resolve(currentDir, '../../server/dist/client');
    const manifestPath = resolve(outDir, '.vite/manifest.json');

    if (!existsSync(manifestPath)) {
        console.error('Missing build output: packages/server/dist/client/.vite/manifest.json');
        console.error('Run pnpm build:client before checking entry budgets.');
        process.exit(1);
    }

    return { outDir, manifest: JSON.parse(readFileSync(manifestPath, 'utf8')) };
};

const build = readBuild();

// Every public page loads these two entries.
const publicPageEntries = ['src/application/client.tsx', 'src/appearance/site-client.ts'];

// Screen pages are application pages whose application entry loads the screen runtime, and the runtime the screen.
const screenRuntime = 'src/screen-runtime.tsx';

// Public pages hydrate only after their document catalog loads, so their totals include the larger one.
// Screens add the rest of the messages before they render, so their totals include the larger screen catalog.
const publicCatalogs = ['src/locales/en/messages.po', 'src/locales/ko/messages.po'];
const screenCatalogs = ['src/locales/en/messages.po?lingui', 'src/locales/ko/messages.po?lingui'];
// The Developer API guide adds its own messages before it renders.
const developerCatalogs = [
    'src/locales/en/messages.po?developer?lingui',
    'src/locales/ko/messages.po?developer?lingui'
];

// Screen budgets count what a screen adds to the application page it opens in: its runtime,
// screen code, and screen catalog. React and the other modules the page already loaded are not counted
// again. Their limits, the runtime's included, keep about 10% headroom over the current
// build (the next whole file for small file counts) so ordinary feature work does not fail on a few bytes,
// and still catch a sudden jump, such as a heavy dependency landing in a shared entry.
// Re-baseline them when headroom runs low.
// Public page limits are fixed targets instead: 150 KiB of compressed JavaScript, and
// 170 KiB for the post page, the mobile JavaScript example in web.dev's budget guide.
const screenBudget = (label, screen, maxInitialFiles, maxInitialKiB, maxInitialGzipKiB) => ({
    entries: [screenRuntime, screen],
    loadedBefore: publicPageEntries,
    catalogs: screenCatalogs,
    reportsPage: true,
    label,
    maxInitialFiles,
    maxInitialBytes: maxInitialKiB * 1024,
    maxInitialGzipBytes: maxInitialGzipKiB * 1024
});

const budgets = [
    {
        entries: [screenRuntime],
        loadedBefore: publicPageEntries,
        label: 'on-demand screen runtime',
        maxInitialFiles: 3,
        maxInitialBytes: 43 * 1024,
        maxInitialGzipBytes: 15 * 1024,
        allowedInitialNames: [
            screenRuntime,
            'rolldown-runtime',
            'jsx-runtime',
            'react',
            'compiler-runtime',
            'react-dom',
            'dist', // @lingui/react runtime
            'shim',
            'IsRestoringProvider',
            'mutation',
            'QueryClientProvider',
            'preload-helper',
            'i18n',
            'locale'
        ],
        blockedHints: [
            '@tanstack/react-router',
            '@tanstack/router-core',
            'tiptap',
            'prosemirror',
            'monaco',
            'radix-ui.com',
            'dialogdescriptionwarning',
            'sonner',
            'data-sonner',
            'frappe-charts',
            'charts',
            'zod'
        ]
    },
    screenBudget('signup screen experience', 'src/features/auth/signup/index.ts', 14, 261, 73),
    screenBudget('search screen experience', 'src/features/search/index.tsx', 13, 256, 71),
    screenBudget('settings screen experience', 'src/features/settings/index.tsx', 10, 363, 104),
    screenBudget('post editor screen experience', 'src/features/editor/index.tsx', 62, 1381, 430),
    {
        entries: ['styles/main.scss'],
        label: 'base page styles',
        maxInitialFiles: 1,
        maxInitialBytes: 2 * 1024,
        maxInitialGzipBytes: 1024,
        allowedInitialNames: ['styles/main.scss']
    },
    {
        // Every page asks for this list before it paints; the fonts it names download only for the text shown.
        entries: ['styles/fonts/pretendard/pretendardvariable-dynamic-subset.css'],
        label: 'font faces',
        maxInitialFiles: 1,
        maxInitialBytes: 56 * 1024,
        maxInitialGzipBytes: 16 * 1024,
        allowedInitialNames: ['styles/fonts/pretendard/pretendardvariable-dynamic-subset.css']
    },
    {
        entries: publicPageEntries,
        catalogs: publicCatalogs,
        label: 'public page scripts',
        maxInitialBytes: 460 * 1024,
        maxInitialGzipBytes: 150 * 1024,
        // Screen pages hold the same application entries, which load the screen runtime only for them.
        requiredDynamicNames: [screenRuntime]
    },
    {
        entries: [...publicPageEntries, 'src/features/discovery/discovery-page.tsx'],
        catalogs: publicCatalogs,
        label: 'public discovery page scripts',
        maxInitialBytes: 460 * 1024,
        maxInitialGzipBytes: 150 * 1024
    },
    // Each author route loads only its own module, so each one has to fit. The owner's inline editor loads after them.
    ...[
        ['overview', ['author-overview-page']],
        ['posts', ['author-posts-page']],
        ['series', ['author-series-page']],
        ['series detail', ['author-series-detail-page']],
        ['introduction editor', ['author-about-edit-page']]
    ].map(([route, modules]) => ({
        entries: [...publicPageEntries, ...modules.map((name) => `src/features/authors/${name}.tsx`)],
        catalogs: publicCatalogs,
        label: `public author page scripts (${route})`,
        maxInitialBytes: 460 * 1024,
        maxInitialGzipBytes: 150 * 1024
    })),
    // Each work log page loads only its own module.
    ...[
        ['list', 'index-page'],
        ['log', 'detail-page'],
        ['delete', 'delete-page'],
        ['shared', 'shared-page']
    ].map(([route, module]) => ({
        entries: [...publicPageEntries, `src/features/work-logs/${module}.tsx`],
        catalogs: publicCatalogs,
        label: `public work log page scripts (${route})`,
        maxInitialBytes: 460 * 1024,
        maxInitialGzipBytes: 150 * 1024
    })),
    // Search, static, error, developer guide, and post management pages also load only their own module.
    ...[
        ['search', 'discovery/search-page'],
        ['static', 'discovery/static-page'],
        ['not found', 'discovery/not-found-page'],
        ['forbidden', 'discovery/forbidden-page'],
        ['developer quickstart', 'developer-api/quickstart'],
        ['revision history', 'posts/revisions-page'],
        ['writing timeline', 'posts/timelapse-page'],
        ['share links', 'posts/share-links-page']
    ].map(([route, module]) => ({
        entries: [...publicPageEntries, `src/features/${module}.tsx`],
        catalogs: publicCatalogs,
        pageCatalogs: module === 'developer-api/quickstart' ? developerCatalogs : undefined,
        label: `public content page scripts (${route})`,
        maxInitialBytes: 460 * 1024,
        maxInitialGzipBytes: 150 * 1024
    })),
    {
        entries: [...publicPageEntries, 'src/features/posts/post-page.tsx', 'src/features/posts/code-blocks-client.ts'],
        catalogs: publicCatalogs,
        label: 'public post page scripts',
        maxInitialBytes: 520 * 1024,
        maxInitialGzipBytes: 170 * 1024
    },
    {
        entries: [...publicPageEntries, 'src/features/auth/ui/login-page.tsx'],
        catalogs: publicCatalogs,
        label: 'public login page scripts',
        maxInitialBytes: 460 * 1024,
        maxInitialGzipBytes: 150 * 1024
    },
    // The sign-up, setup, identity check, and password reset forms each load only their own module.
    ...[
        ['sign up', 'signup-page'],
        ['setup', 'setup-page'],
        ['identity check', 'reauthenticate-page'],
        ['password reset', 'password-reset-page']
    ].map(([route, module]) => ({
        entries: [...publicPageEntries, `src/features/auth/ui/${module}.tsx`],
        catalogs: publicCatalogs,
        label: `public auth form page scripts (${route})`,
        maxInitialBytes: 460 * 1024,
        maxInitialGzipBytes: 150 * 1024
    }))
];

const assetBudgets = [
    {
        entry: 'src/appearance/site-client.ts',
        label: 'shared theme and post styles',
        maxAssets: 1,
        maxBytes: 146 * 1024,
        maxGzipBytes: 24 * 1024
    }
];

const formatKiB = (bytes) => `${(bytes / 1024).toFixed(1)} KiB`;

const getSearchValue = (item, key) => [key, item.name, item.src, item.file].filter(Boolean).join(' ');

const collectInitialGraph = ({ manifest }, entryKeys) => {
    const visited = new Set();
    const visit = (key) => {
        if (visited.has(key)) {
            return;
        }

        const item = manifest[key];

        if (!item) {
            throw new Error(`Missing manifest entry: ${key}`);
        }

        visited.add(key);

        for (const importedKey of item.imports ?? []) {
            visit(importedKey);
        }
    };

    entryKeys.forEach(visit);

    return [...visited];
};

const getItemName = ({ manifest }, key) => {
    const item = manifest[key];
    return item?.src ?? item?.name ?? key;
};

const collectDynamicNames = (build, entryKeys) =>
    new Set(
        entryKeys.flatMap((entryKey) =>
            (build.manifest[entryKey]?.dynamicImports ?? []).map((key) => getItemName(build, key))
        )
    );

const getFileStats = ({ manifest, outDir }, key) => {
    const item = manifest[key];
    const filePath = resolve(outDir, item.file);
    const source = readFileSync(filePath, 'utf8');

    return {
        key,
        label: item.src ?? item.name ?? key,
        name: item.src ?? item.name ?? key,
        file: item.file,
        rawBytes: statSync(filePath).size,
        gzipBytes: gzipSync(source).length,
        value: getSearchValue(item, key),
        source
    };
};

const getLargestCatalog = (build, keys) => {
    const catalogs = keys.filter((key) => build.manifest[key]).map((key) => getFileStats(build, key));
    if (catalogs.length !== keys.length) {
        throw new Error(`Missing catalogs: ${keys.join(', ')}`);
    }
    return catalogs.reduce((largest, item) => (item.gzipBytes > largest.gzipBytes ? item : largest));
};

const sumBytes = (stats) => ({
    rawBytes: stats.reduce((sum, item) => sum + item.rawBytes, 0),
    gzipBytes: stats.reduce((sum, item) => sum + item.gzipBytes, 0)
});

let hasFailure = false;

for (const budget of budgets) {
    const loadedBefore = new Set(budget.loadedBefore ? collectInitialGraph(build, budget.loadedBefore) : []);
    const graph = collectInitialGraph(build, [...(budget.loadedBefore ?? []), ...budget.entries]);
    const stats = graph.filter((key) => !loadedBefore.has(key)).map((key) => getFileStats(build, key));
    if (budget.catalogs) stats.push(getLargestCatalog(build, budget.catalogs));
    if (budget.pageCatalogs) stats.push(getLargestCatalog(build, budget.pageCatalogs));
    const { rawBytes: totalRawBytes, gzipBytes: totalGzipBytes } = sumBytes(stats);
    const unexpectedStats = budget.allowedInitialNames
        ? stats.filter((item) => !budget.allowedInitialNames.includes(item.name))
        : [];
    const blockedStats = budget.blockedHints
        ? stats
              .map((item) => {
                  const haystack = `${item.value}\n${item.source}`.toLowerCase();
                  const hits = budget.blockedHints.filter((hint) => haystack.includes(hint));
                  return { ...item, hits };
              })
              .filter((item) => item.hits.length > 0)
        : [];
    const dynamicNames = collectDynamicNames(build, budget.entries);
    const missingDynamicNames = (budget.requiredDynamicNames ?? []).filter((name) => !dynamicNames.has(name));

    console.log(`Entry budget report: ${budget.label}`);
    console.log(`- Files: ${stats.length}`);
    console.log(`- Raw size: ${formatKiB(totalRawBytes)}`);
    console.log(`- Gzip size: ${formatKiB(totalGzipBytes)}`);

    if (budget.reportsPage) {
        // For reference only: everything the screen page downloads, including the application entry.
        const page = sumBytes([
            ...graph.map((key) => getFileStats(build, key)),
            getLargestCatalog(build, publicCatalogs),
            getLargestCatalog(build, screenCatalogs)
        ]);
        console.log(`- Whole page, no limit: ${formatKiB(page.rawBytes)} raw / ${formatKiB(page.gzipBytes)} gzip`);
    }

    if (budget.allowedInitialNames || budget.blockedHints) {
        for (const item of stats) {
            console.log(
                `  - ${item.label} -> ${item.file} (${formatKiB(item.rawBytes)} raw / ${formatKiB(item.gzipBytes)} gzip)`
            );
        }
    }

    const violations = [];

    if (budget.maxInitialFiles && stats.length > budget.maxInitialFiles) {
        violations.push(`${budget.label} imports ${stats.length} files, limit is ${budget.maxInitialFiles}`);
    }

    if (totalRawBytes > budget.maxInitialBytes) {
        violations.push(
            `${budget.label} raw size is ${formatKiB(totalRawBytes)}, limit is ${formatKiB(budget.maxInitialBytes)}`
        );
    }

    if (totalGzipBytes > budget.maxInitialGzipBytes) {
        violations.push(
            `${budget.label} gzip size is ${formatKiB(totalGzipBytes)}, limit is ${formatKiB(budget.maxInitialGzipBytes)}`
        );
    }

    if (unexpectedStats.length > 0) {
        violations.push(
            `${budget.label} has unexpected initial imports: ${unexpectedStats.map((item) => item.label).join(', ')}`
        );
    }

    if (blockedStats.length > 0) {
        violations.push(
            `${budget.label} includes blocked feature code: ${blockedStats.map((item) => `${item.label} (${item.hits.join(', ')})`).join(', ')}`
        );
    }

    if (missingDynamicNames.length > 0) {
        violations.push(`${budget.label} no longer defers required modules: ${missingDynamicNames.join(', ')}`);
    }

    if (violations.length > 0) {
        hasFailure = true;
        console.error('Budget violations detected:');
        for (const violation of violations) {
            console.error(`- ${violation}`);
        }
    }
}

for (const budget of assetBudgets) {
    const item = build.manifest[budget.entry];
    if (!item) {
        throw new Error(`Missing manifest entry: ${budget.entry}`);
    }

    const assets = item.css ?? [];
    const contents = assets.map((file) => readFileSync(resolve(build.outDir, file)));
    const totalBytes = contents.reduce((sum, source) => sum + source.length, 0);
    const totalGzipBytes = contents.reduce((sum, source) => sum + gzipSync(source).length, 0);
    const violations = [];

    console.log(`Asset budget report: ${budget.label}`);
    console.log(`- Files: ${assets.length}`);
    console.log(`- Raw size: ${formatKiB(totalBytes)}`);
    console.log(`- Gzip size: ${formatKiB(totalGzipBytes)}`);

    if (assets.length === 0) violations.push(`${budget.label} is missing its stylesheet`);

    if (totalGzipBytes > budget.maxGzipBytes) {
        violations.push(
            `${budget.label} gzip size is ${formatKiB(totalGzipBytes)}, limit is ${formatKiB(budget.maxGzipBytes)}`
        );
    }

    if (assets.length > budget.maxAssets) {
        violations.push(`${budget.label} includes ${assets.length} assets, limit is ${budget.maxAssets}`);
    }

    if (totalBytes > budget.maxBytes) {
        violations.push(`${budget.label} raw size is ${formatKiB(totalBytes)}, limit is ${formatKiB(budget.maxBytes)}`);
    }

    if (violations.length > 0) {
        hasFailure = true;
        console.error('Budget violations detected:');
        for (const violation of violations) {
            console.error(`- ${violation}`);
        }
    }
}

// These entries load through redirecting /assets/blex aliases, and browsers key modules by the requested URL.
// A chunk that imports one by its hashed file would run it a second time.
const redirectedEntries = new Set(publicPageEntries);

for (const [key, item] of Object.entries(build.manifest)) {
    const imported = [...(item.imports ?? []), ...(item.dynamicImports ?? [])].filter((name) =>
        redirectedEntries.has(name)
    );
    if (imported.length > 0) {
        hasFailure = true;
        console.error(`${key} imports a redirected entry and would run it twice: ${imported.join(', ')}`);
    }
}

if (hasFailure) {
    process.exit(1);
}
