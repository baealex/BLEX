import { spawnSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function parseVersion(value) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)) {
    throw new Error('Release versions must use MAJOR.MINOR without a leading v.');
  }
  const [major, minor] = value.split('.').map(Number);
  if (![major, minor].every(Number.isSafeInteger)) throw new Error('Release version is too large.');
  return { major, minor };
}

function compareVersions(left, right) {
  return left.major - right.major || left.minor - right.minor;
}

export function planRelease({ requested = '', packageVersion, tags, allowExisting = false }) {
  const major = Number(packageVersion.split('.')[0]);
  const versions = tags
    .filter((tag) => /^v(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag))
    .map((tag) => parseVersion(tag.slice(1)))
    .sort(compareVersions);
  const latest = versions.at(-1);
  const current = versions.filter((version) => version.major === major).at(-1);
  const version = requested || `${major}.${current ? current.minor + 1 : 0}`;
  const parsed = parseVersion(version);
  if (parsed.major !== major) throw new Error('Release major must match package.json.');
  if (latest && compareVersions(parsed, latest) < 0) throw new Error('Cannot publish an older release as latest.');
  if (!allowExisting && tags.includes(`v${version}`)) throw new Error(`Release v${version} already exists.`);
  return { version, tag: `v${version}`, major: String(parsed.major) };
}

function command(program, args) {
  const result = spawnSync(program, args, { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${program} failed: ${result.stderr.trim() || result.stdout.trim()}`);
  return result.stdout.trim();
}

export function inspectImage(reference, execute = command) {
  const manifest = execute('docker', ['buildx', 'imagetools', 'inspect', reference]);
  const digest = manifest.match(/^Digest:\s+(sha256:[a-f0-9]{64})$/m)?.[1];
  if (!digest || !manifest.includes('linux/amd64') || !manifest.includes('linux/arm64')) {
    throw new Error(`Image must include AMD64 and ARM64 manifests: ${reference}`);
  }
  return digest;
}

export function publishRelease({ image, digest, sha, version, repository, existingTag }, execute = command) {
  const { major } = parseVersion(version);
  if (!/^sha256:[a-f0-9]{64}$/.test(digest)) throw new Error('Invalid candidate digest.');
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('Invalid release commit.');
  if (existingTag && existingTag !== sha) throw new Error('The Git version tag belongs to another commit.');
  if (inspectImage(`${image}@${digest}`, execute) !== digest) throw new Error('Candidate digest mismatch.');

  let existingDigest;
  try {
    existingDigest = inspectImage(`${image}:${version}`, execute);
  } catch (error) {
    if (!/manifest unknown|no such manifest|:\s*not found(?:\s|$)/i.test(error.message)) throw error;
  }
  if (existingDigest && existingDigest !== digest) throw new Error('The Docker version tag belongs to another image.');

  const aliases = [version, String(major), 'latest'];
  execute('docker', [
    'buildx',
    'imagetools',
    'create',
    ...aliases.flatMap((tag) => ['--tag', `${image}:${tag}`]),
    `${image}@${digest}`,
  ]);
  for (const tag of aliases) {
    if (inspectImage(`${image}:${tag}`, execute) !== digest) throw new Error(`Published digest mismatch: ${tag}`);
  }
  if (!existingTag) {
    const tag = JSON.parse(
      execute('gh', [
        'api',
        '--method',
        'POST',
        `repos/${repository}/git/refs`,
        '-f',
        `ref=refs/tags/v${version}`,
        '-f',
        `sha=${sha}`,
      ]),
    );
    if (tag.ref !== `refs/tags/v${version}` || tag.object?.sha !== sha) throw new Error('Published Git tag mismatch.');
  }
}

function main(mode) {
  if (!['prepare', 'publish'].includes(mode)) throw new Error('Usage: release.mjs prepare|publish');
  if (process.env.GITHUB_REF !== 'refs/heads/main') throw new Error('Run releases from main.');
  const sha = command('git', ['rev-parse', 'HEAD']);
  if (sha !== process.env.GITHUB_SHA) throw new Error('Checkout does not match the requested release commit.');
  command('git', ['fetch', '--tags', 'origin', 'main']);
  command('git', ['merge-base', '--is-ancestor', sha, 'origin/main']);
  const tags = command('git', ['tag', '--list']).split('\n');
  const release = planRelease({
    requested: process.env.RELEASE_VERSION,
    packageVersion: JSON.parse(readFileSync('package.json', 'utf8')).version,
    tags,
    allowExisting: mode === 'publish',
  });
  if (mode === 'prepare') {
    appendFileSync(process.env.GITHUB_OUTPUT, `version=${release.version}\nsha=${sha}\n`);
    console.log(`Preparing ${release.tag} from ${sha}`);
    return;
  }
  if (!process.env.RELEASE_VERSION) throw new Error('Publish requires the prepared version.');
  const existingTag = tags.includes(release.tag) ? command('git', ['rev-parse', `${release.tag}^{commit}`]) : undefined;
  publishRelease({
    image: process.env.IMAGE,
    digest: process.env.IMAGE_DIGEST,
    sha,
    version: release.version,
    repository: process.env.GITHUB_REPOSITORY,
    existingTag,
  });
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `## Released ${release.tag}\n\nCommit: \`${sha}\`\n\nImage: \`${process.env.IMAGE}@${process.env.IMAGE_DIGEST}\`\n\nDocker tags: \`${release.version}\`, \`${release.major}\`, \`latest\`\n`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main(process.argv[2]);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
