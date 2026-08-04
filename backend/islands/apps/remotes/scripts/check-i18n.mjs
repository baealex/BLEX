import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { setupI18n } from '@lingui/core';

const currentDir = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(currentDir, '..');
const catalogDir = resolve(appDir, 'src/locales');
const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

const snapshotCatalogs = () => {
    const snapshot = new Map();

    const visit = (directory) => {
        if (!existsSync(directory)) {
            return;
        }

        for (const entry of readdirSync(directory, { withFileTypes: true })) {
            const path = resolve(directory, entry.name);
            if (entry.isDirectory()) {
                visit(path);
            } else if (entry.isFile() && entry.name.endsWith('.po')) {
                snapshot.set(relative(appDir, path), readFileSync(path, 'utf8'));
            }
        }
    };

    visit(catalogDir);
    return snapshot;
};

const runLingui = (args) => {
    const result = spawnSync(
        pnpmCommand,
        ['exec', 'lingui', ...args],
        { cwd: appDir, stdio: 'inherit' }
    );

    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
};

const loadCompiledCatalog = async (locale) => {
    const catalogUrl = pathToFileURL(
        resolve(catalogDir, locale, 'messages.mjs')
    );
    catalogUrl.searchParams.set('check', String(Date.now()));

    const { messages } = await import(catalogUrl.href);
    return messages;
};

const verifyRuntimeCatalogs = async () => {
    const expectedCounts = {
        en: ['0 posts', '1 post', '2 posts'],
        ko: ['0개의 포스트', '1개의 포스트', '2개의 포스트']
    };

    for (const [locale, expected] of Object.entries(expectedCounts)) {
        const messages = await loadCompiledCatalog(locale);
        const runtime = setupI18n({
            locale,
            messages: { [locale]: messages }
        });
        const actual = [0, 1, 2].map((count) => (
            runtime._('search.results.count', { 0: count })
        ));

        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            console.error(`Unexpected ${locale} plural output: ${actual.join(' | ')}`);
            process.exit(1);
        }
    }

    const pseudoMessages = await loadCompiledCatalog('pseudo');
    const pseudoRuntime = setupI18n({
        locale: 'pseudo',
        messages: { pseudo: pseudoMessages }
    });
    const pseudoTitle = pseudoRuntime._('search.title');

    if (!pseudoTitle.includes('⟦') || !pseudoTitle.includes('⟧') || pseudoTitle === 'search.title') {
        console.error(`Pseudo locale did not render a transformed message: ${pseudoTitle}`);
        process.exit(1);
    }
};

const before = snapshotCatalogs();

runLingui(['extract', '--clean']);
runLingui(['compile', '--strict']);
await verifyRuntimeCatalogs();

const after = snapshotCatalogs();
const paths = new Set([...before.keys(), ...after.keys()]);
const changedPaths = [...paths]
    .filter((path) => before.get(path) !== after.get(path))
    .sort();

if (changedPaths.length > 0) {
    console.error('Lingui catalogs are stale:');
    changedPaths.forEach((path) => console.error(`- ${path}`));
    console.error('Run "pnpm i18n:extract", translate missing messages, and compile again.');
    process.exit(1);
}

console.log('Lingui catalogs are current, complete, and runtime-checked.');
