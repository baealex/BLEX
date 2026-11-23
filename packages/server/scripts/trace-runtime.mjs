import { nodeFileTrace } from '@vercel/nft';
import { copyFile, lstat, mkdir, readlink, symlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const [target, ...entries] = process.argv.slice(2);
if (!target || entries.length === 0) {
  console.error('Usage: node trace-runtime.mjs <target-directory> <entry>...');
  process.exit(1);
}

const base = resolve(import.meta.dirname, '../../..');
// Prisma only loads TypeScript for a TypeScript config file, which BLEX does not have.
const ignore = (path) => path.includes('/typescript@');
const { fileList, warnings } = await nodeFileTrace(
  entries.map((entry) => resolve(entry)),
  { base, ignore },
);
const unresolved = [...warnings].filter((warning) => warning.code === 'MODULE_NOT_FOUND');
for (const warning of unresolved) console.warn(warning.message);

let bytes = 0;
for (const file of fileList) {
  const source = resolve(base, file);
  const destination = resolve(target, file);
  const stats = await lstat(source);
  await mkdir(dirname(destination), { recursive: true });
  if (stats.isSymbolicLink()) {
    await symlink(await readlink(source), destination);
  } else if (stats.isFile()) {
    await copyFile(source, destination);
    bytes += stats.size;
  }
}
console.log(`Traced ${fileList.size} paths, ${Math.round(bytes / 1_000_000)} MB`);
