import { readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const currentDir = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(currentDir, '../../../../src/resources/staticfiles/islands');
const manifestPath = resolve(outDir, '.vite/manifest.json');

const budgets = [
    {
        entries: [
            'src/scripts/island-loader.ts',
            'src/scripts/lazy-loading.ts',
            'src/scripts/alpine-loader.ts'
        ],
        label: 'base page scripts',
        maxInitialFiles: 6,
        maxInitialBytes: 65 * 1024,
        maxInitialGzipBytes: 23 * 1024,
        allowedInitialNames: [
            'src/scripts/island-loader.ts',
            'preload-helper',
            'src/scripts/lazy-loading.ts',
            'src/scripts/alpine-loader.ts',
            'theme',
            'loginPrompt'
        ],
        requiredDynamicNames: [
            'src/island.tsx',
            'toast'
        ]
    },
    {
        entries: ['src/island.tsx'],
        label: 'on-demand island runtime',
        maxInitialFiles: 13,
        maxInitialBytes: 235 * 1024,
        maxInitialGzipBytes: 78 * 1024,
        allowedInitialNames: [
            'src/island.tsx',
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
            '@blex/editor',
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
        entries: ['src/island.tsx', 'src/components/remotes/Login/index.ts'],
        label: 'login island experience',
        maxInitialBytes: 350 * 1024,
        maxInitialGzipBytes: 118 * 1024
    },
    {
        entries: ['src/island.tsx', 'src/components/remotes/Signup/index.ts'],
        label: 'signup island experience',
        maxInitialBytes: 350 * 1024,
        maxInitialGzipBytes: 115 * 1024
    },
    {
        entries: ['src/island.tsx', 'src/components/remotes/SearchPage/index.tsx'],
        label: 'search island experience',
        maxInitialBytes: 310 * 1024,
        maxInitialGzipBytes: 103 * 1024
    },
    {
        entries: ['src/island.tsx', 'src/components/remotes/SettingsApp/index.tsx'],
        label: 'settings island experience',
        maxInitialBytes: 480 * 1024,
        maxInitialGzipBytes: 163 * 1024
    },
    {
        entries: ['src/island.tsx', 'src/components/remotes/PostEditor/index.ts'],
        label: 'post editor island experience',
        maxInitialBytes: 1350 * 1024,
        maxInitialGzipBytes: 437 * 1024
    },
    {
        entries: ['src/island.tsx', 'src/components/remotes/Comments/index.ts'],
        label: 'comments island experience',
        maxInitialBytes: 465 * 1024,
        maxInitialGzipBytes: 157 * 1024
    },
    {
        entries: ['styles/main.scss', 'styles/tailwind.css'],
        label: 'base page styles',
        maxInitialFiles: 2,
        maxInitialBytes: 200 * 1024,
        maxInitialGzipBytes: 43 * 1024,
        allowedInitialNames: [
            'styles/main.scss',
            'styles/tailwind.css'
        ]
    },
    {
        entries: ['styles/main.scss', 'styles/tailwind.css', 'styles/post.scss'],
        label: 'post page styles',
        maxInitialFiles: 3,
        maxInitialBytes: 212 * 1024,
        maxInitialGzipBytes: 46 * 1024,
        allowedInitialNames: [
            'styles/main.scss',
            'styles/tailwind.css',
            'styles/post.scss'
        ]
    }
];

const assetBudgets = [
    {
        entry: 'styles/main.scss',
        label: 'base page font assets',
        maxAssets: 4,
        maxBytes: 275 * 1024
    }
];

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

const formatKiB = (bytes) => `${(bytes / 1024).toFixed(1)} KiB`;

const getSearchValue = (item, key) =>
    [key, item.name, item.src, item.file].filter(Boolean).join(' ');

const collectInitialGraph = (entryKeys) => {
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

const getItemName = (key) => {
    const item = manifest[key];
    return item?.src ?? item?.name ?? key;
};

const collectDynamicNames = (entryKeys) => new Set(
    entryKeys.flatMap((entryKey) =>
        (manifest[entryKey]?.dynamicImports ?? []).map(getItemName)
    )
);

const getFileStats = (key) => {
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
    const stats = collectInitialGraph(budget.entries).map(getFileStats);
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
    const dynamicNames = collectDynamicNames(budget.entries);
    const missingDynamicNames = (budget.requiredDynamicNames ?? [])
        .filter((name) => !dynamicNames.has(name));

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
        violations.push(
            `${budget.label} imports ${stats.length} files, limit is ${budget.maxInitialFiles}`
        );
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
        violations.push(
            `${budget.label} no longer defers required modules: ${missingDynamicNames.join(', ')}`
        );
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
    const item = manifest[budget.entry];
    if (!item) {
        throw new Error(`Missing manifest entry: ${budget.entry}`);
    }

    const assets = item.assets ?? [];
    const totalBytes = assets.reduce(
        (sum, file) => sum + statSync(resolve(outDir, file)).size,
        0
    );
    const violations = [];

    console.log(`Asset budget report: ${budget.label}`);
    console.log(`- Files: ${assets.length}`);
    console.log(`- Raw size: ${formatKiB(totalBytes)}`);

    if (assets.length > budget.maxAssets) {
        violations.push(
            `${budget.label} includes ${assets.length} assets, limit is ${budget.maxAssets}`
        );
    }

    if (totalBytes > budget.maxBytes) {
        violations.push(
            `${budget.label} raw size is ${formatKiB(totalBytes)}, limit is ${formatKiB(budget.maxBytes)}`
        );
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
