import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const currentDir = dirname(fileURLToPath(import.meta.url));

const readBuild = (name) => {
    const outDir = resolve(currentDir, '../../server/dist', name);
    const manifestPath = resolve(outDir, '.vite/manifest.json');

    if (!existsSync(manifestPath)) {
        console.error(`Missing build output: packages/server/dist/${name}/.vite/manifest.json`);
        console.error('Run pnpm build:client before checking entry budgets.');
        process.exit(1);
    }

    return { outDir, manifest: JSON.parse(readFileSync(manifestPath, 'utf8')) };
};

const builds = { web: readBuild('web'), client: readBuild('client') };

// Every public page loads these two entries from the separate build served at /assets/ui/.
const publicPageEntries = ['src/application/client.tsx', 'src/appearance/site-client.ts'];

// Size limits keep about 10% headroom over the current build so ordinary feature work
// does not fail on a few bytes. They still catch a sudden jump, such as a heavy
// dependency landing in a shared entry. Re-baseline them when headroom runs low.
const budgets = [
    {
        entries: ['src/scripts/screen-loader.ts'],
        label: 'base page scripts',
        maxInitialFiles: 6,
        maxInitialBytes: 65 * 1024,
        maxInitialGzipBytes: 24 * 1024,
        allowedInitialNames: ['src/scripts/screen-loader.ts', 'preload-helper', 'theme'],
        requiredDynamicNames: ['src/screen-runtime.tsx', 'toast']
    },
    {
        entries: ['src/screen-runtime.tsx'],
        label: 'on-demand screen runtime',
        maxInitialFiles: 13,
        maxInitialBytes: 260 * 1024,
        maxInitialGzipBytes: 85 * 1024,
        allowedInitialNames: [
            'src/screen-runtime.tsx',
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
    {
        entries: ['src/screen-runtime.tsx', 'src/features/auth/signup/index.ts'],
        label: 'signup screen experience',
        maxInitialBytes: 350 * 1024,
        maxInitialGzipBytes: 117 * 1024
    },
    {
        entries: ['src/screen-runtime.tsx', 'src/features/search/index.tsx'],
        label: 'search screen experience',
        maxInitialBytes: 345 * 1024,
        maxInitialGzipBytes: 114 * 1024
    },
    {
        entries: ['src/screen-runtime.tsx', 'src/features/settings/index.tsx'],
        label: 'settings screen experience',
        maxInitialBytes: 530 * 1024,
        maxInitialGzipBytes: 176 * 1024
    },
    {
        entries: ['src/screen-runtime.tsx', 'src/features/editor/index.tsx'],
        label: 'post editor screen experience',
        maxInitialBytes: 1475 * 1024,
        maxInitialGzipBytes: 478 * 1024
    },
    {
        entries: ['styles/main.scss'],
        label: 'base page styles',
        maxInitialFiles: 1,
        maxInitialBytes: 2 * 1024,
        maxInitialGzipBytes: 1024,
        allowedInitialNames: ['styles/main.scss']
    },
    {
        build: 'client',
        entries: publicPageEntries,
        label: 'public page scripts',
        maxInitialBytes: 380 * 1024,
        maxInitialGzipBytes: 123 * 1024
    },
    {
        build: 'client',
        entries: [
            ...publicPageEntries,
            'src/features/engagement/ui/comments-client.tsx',
            'src/features/posts/code-blocks-client.ts'
        ],
        label: 'public post page scripts',
        maxInitialBytes: 430 * 1024,
        maxInitialGzipBytes: 141 * 1024
    },
    {
        build: 'client',
        entries: [...publicPageEntries, 'src/features/auth/ui/login-client.tsx'],
        label: 'public login page scripts',
        maxInitialBytes: 390 * 1024,
        maxInitialGzipBytes: 127 * 1024
    },
    {
        build: 'client',
        entries: [...publicPageEntries, 'src/application/screen-host/client.ts'],
        label: 'public screen host scripts',
        maxInitialBytes: 380 * 1024,
        maxInitialGzipBytes: 124 * 1024
    }
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

let hasFailure = false;

for (const budget of budgets) {
    const build = builds[budget.build ?? 'web'];
    const stats = collectInitialGraph(build, budget.entries).map((key) => getFileStats(build, key));
    const totalRawBytes = stats.reduce((sum, item) => sum + item.rawBytes, 0);
    const totalGzipBytes = stats.reduce((sum, item) => sum + item.gzipBytes, 0);
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
    const item = builds.client.manifest[budget.entry];
    if (!item) {
        throw new Error(`Missing manifest entry: ${budget.entry}`);
    }

    const assets = item.css ?? [];
    const contents = assets.map((file) => readFileSync(resolve(builds.client.outDir, file)));
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

if (hasFailure) {
    process.exit(1);
}
