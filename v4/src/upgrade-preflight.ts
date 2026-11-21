import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

interface UpgradeState {
  portMapping: string;
  containerPort: string;
  legacyDatabase: boolean;
  currentDatabase: boolean;
}

/** Finds 3.x Compose settings that would otherwise start an unreachable or empty BLEX 4 site. */
export function upgradeProblems({ portMapping, containerPort, legacyDatabase, currentDatabase }: UpgradeState): string[] {
  const problems: string[] = [];
  const mappedPort = portMapping.split('/')[0].split(':').at(-1);
  if (mappedPort !== containerPort) {
    const suggested = [...portMapping.split('/')[0].split(':').slice(0, -1), containerPort].join(':');
    problems.push(`BLEX_PORT_MAPPING points to container port ${mappedPort}, but BLEX 4 listens on ${containerPort}. Change it to ${suggested}.`);
  }
  if (legacyDatabase && !currentDatabase) {
    problems.push('Found a BLEX 3.x database at backend/src/db.sqlite3, but the BLEX 4 data directory is empty. Follow the upgrade guide in v4/README.md and set BLEX_DATA to the upgraded copy, or move the old database to start a new site.');
  }
  return problems;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const problems = upgradeProblems({
    portMapping: process.env.BLEX_PORT_MAPPING ?? '',
    containerPort: process.env.BLEX_CONTAINER_PORT ?? '8040',
    legacyDatabase: existsSync('/legacy/db.sqlite3'),
    currentDatabase: existsSync('/var/lib/blex/db.sqlite3'),
  });
  for (const problem of problems) console.error(problem);
  if (problems.length) process.exitCode = 1;
}
