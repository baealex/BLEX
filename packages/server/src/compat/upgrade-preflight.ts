import { accessSync, constants, existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

interface UpgradeState {
  portMapping: string;
  containerPort: string;
  legacyDatabase: boolean;
  currentDatabase: boolean;
  unwritableMediaFolders?: number;
}

/** Finds 3.x Compose settings that would otherwise start an unreachable or empty BLEX 4 site. */
export function upgradeProblems({ portMapping, containerPort, legacyDatabase, currentDatabase, unwritableMediaFolders = 0 }: UpgradeState): string[] {
  const problems: string[] = [];
  const mappedPort = portMapping.split('/')[0].split(':').at(-1);
  if (mappedPort !== containerPort) {
    const suggested = [...portMapping.split('/')[0].split(':').slice(0, -1), containerPort].join(':');
    problems.push(`BLEX_PORT_MAPPING points to container port ${mappedPort}, but BLEX 4 listens on ${containerPort}. Change it to ${suggested}.`);
  }
  if (legacyDatabase && !currentDatabase) {
    problems.push('Found a BLEX 3.x database at backend/src/db.sqlite3, but the BLEX 4 data directory is empty. Follow the upgrade guide in v4/README.md and set BLEX_DATA to the upgraded copy, or move the old database to start a new site.');
  }
  if (unwritableMediaFolders) {
    problems.push(`BLEX 4 runs as uid 1000 and cannot write to ${unwritableMediaFolders} media folders, so uploads would fail. Run chown -R 1000:1000 on the media directory.`);
  }
  return problems;
}

/** 3.x wrote some media as root, which the unprivileged BLEX 4 process cannot add files to. */
export function countUnwritableFolders(root: string): number {
  if (!existsSync(root)) return 0;
  let count = 0;
  const pending = [root];
  for (let current = pending.pop(); current; current = pending.pop()) {
    try {
      accessSync(current, constants.W_OK | constants.X_OK);
    } catch {
      count += 1;
    }
    try {
      for (const entry of readdirSync(current, { withFileTypes: true })) {
        if (entry.isDirectory()) pending.push(join(current, entry.name));
      }
    } catch { /* Already counted as unwritable when it cannot be listed. */ }
  }
  return count;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const problems = upgradeProblems({
    portMapping: process.env.BLEX_PORT_MAPPING ?? '',
    containerPort: process.env.BLEX_CONTAINER_PORT ?? '8040',
    legacyDatabase: existsSync('/legacy/db.sqlite3'),
    currentDatabase: existsSync('/var/lib/blex/db.sqlite3'),
    unwritableMediaFolders: countUnwritableFolders(process.env.BLEX_V4_MEDIA_PATH ?? '/var/lib/blex/media'),
  });
  for (const problem of problems) console.error(problem);
  if (problems.length) process.exitCode = 1;
}
