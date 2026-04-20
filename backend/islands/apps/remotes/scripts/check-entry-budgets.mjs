import { readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const currentDir = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(currentDir, '../../../../src/resources/staticfiles/islands');
const manifestPath = resolve(outDir, '.vite/manifest.json');

const budgets = [
    {
        entry: 'src/island.tsx',
        label: 'island bootstrap',
        maxInitialFiles: 2,
        maxInitialBytes: 245 * 1024,
        maxInitialGzipBytes: 80 * 1024,
        allowedInitialNames: ['src/island.tsx', 'preload-helper', '_commonjsHelpers'],
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
    }
];

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

const formatKiB = (bytes) => `${(bytes / 1024).toFixed(1)} KiB`;

const getSearchValue = (item, key) =>
    [key, item.name, item.src, item.file].filter(Boolean).join(' ');

const collectInitialGraph = (entryKey) => {
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

    visit(entryKey);

    return [...visited];
};

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
    const stats = collectInitialGraph(budget.entry).map(getFileStats);
    const totalRawBytes = stats.reduce((sum, item) => sum + item.rawBytes, 0);
    const totalGzipBytes = stats.reduce((sum, item) => sum + item.gzipBytes, 0);
    const unexpectedStats = stats.filter(
        (item) => !budget.allowedInitialNames.includes(item.name)
    );
    const blockedStats = stats
        .map((item) => {
            const haystack = `${item.value}\n${item.source}`.toLowerCase();
            const hits = budget.blockedHints.filter((hint) => haystack.includes(hint));
            return { ...item, hits };
        })
        .filter((item) => item.hits.length > 0);

    console.log(`Entry budget report: ${budget.label}`);
    console.log(`- Files: ${stats.length}`);
    console.log(`- Raw size: ${formatKiB(totalRawBytes)}`);
    console.log(`- Gzip size: ${formatKiB(totalGzipBytes)}`);

    for (const item of stats) {
        console.log(
            `  - ${item.label} -> ${item.file} (${formatKiB(item.rawBytes)} raw / ${formatKiB(item.gzipBytes)} gzip)`
        );
    }

    const violations = [];

    if (stats.length > budget.maxInitialFiles) {
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
