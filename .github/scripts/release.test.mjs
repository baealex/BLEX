import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { inspectImage, parseVersion, planRelease, publishRelease } from './release.mjs';

const sha = 'a'.repeat(40);
const digest = `sha256:${'b'.repeat(64)}`;
const otherDigest = `sha256:${'c'.repeat(64)}`;
const image = 'example/blex';
const release = { image, digest, sha, version: '4.2', repository: 'example/BLEX' };

function registry({ versionDigest, missingArm = false, inspectFailure, corruptAlias, failTag = false } = {}) {
  const images = new Map([[`${image}@${digest}`, digest]]);
  if (versionDigest) images.set(`${image}:4.2`, versionDigest);
  const calls = [];
  const writes = [];
  function execute(program, args) {
    calls.push([program, ...args]);
    if (program === 'gh') {
      writes.push([program, ...args]);
      if (failTag) throw new Error('Git tag publication failed');
      return JSON.stringify({ ref: 'refs/tags/v4.2', object: { sha } });
    }
    assert.equal(program, 'docker');
    assert.deepEqual(args.slice(0, 2), ['buildx', 'imagetools']);
    if (args[2] === 'inspect') {
      const reference = args[3];
      if (inspectFailure && reference === `${image}:4.2`) throw new Error(inspectFailure);
      if (!images.has(reference)) throw new Error(`${reference}: not found`);
      return `Digest: ${images.get(reference)}\n  Platform: linux/amd64\n${missingArm ? '' : '  Platform: linux/arm64/v8\n'}`;
    }
    assert.equal(args[2], 'create');
    assert.equal(args.at(-1), `${image}@${digest}`);
    writes.push([program, ...args]);
    for (let index = 3; index < args.length - 1; index += 2) {
      assert.equal(args[index], '--tag');
      images.set(args[index + 1], args[index + 1] === corruptAlias ? otherDigest : digest);
    }
    return '';
  }
  return { execute, images, calls, writes };
}

test('uses existing Git versions to select the next minor numerically', () => {
  assert.deepEqual(planRelease({ packageVersion: '4.0.0', tags: ['v3.14', 'v4.9', 'v4.10', 'preview'] }), {
    version: '4.11',
    tag: 'v4.11',
    major: '4',
  });
  assert.equal(planRelease({ packageVersion: '4.0.0', tags: ['v3.14'] }).version, '4.0');
});

test('accepts an explicit new version in the package major', () => {
  assert.equal(planRelease({ requested: '4.3', packageVersion: '4.0.0', tags: ['v4.1'] }).version, '4.3');
});

test('rejects malformed, duplicate, older, and wrong-major releases', () => {
  for (const version of ['v4.2', '4.2.0', '04.2', '4.02', '4.2\n', '4.2; echo invalid', '4.9007199254740992']) {
    assert.throws(() => parseVersion(version));
  }
  const context = { packageVersion: '4.0.0', tags: ['v4.1'] };
  assert.throws(() => planRelease({ ...context, requested: '4.1' }), /already exists/);
  assert.throws(() => planRelease({ ...context, requested: '4.0', allowExisting: true }), /older release/);
  assert.throws(() => planRelease({ ...context, requested: '5.0' }), /major must match/);
  assert.throws(() => planRelease({ packageVersion: '4.0.0', tags: ['v5.0'] }), /older release/);
});

test('permits retrying the prepared version without advancing it', () => {
  assert.equal(
    planRelease({ requested: '4.2', packageVersion: '4.0.0', tags: ['v4.2'], allowExisting: true }).version,
    '4.2',
  );
});

test('publishes the tested digest to version, major, and latest before creating the Git tag', () => {
  const remote = registry();
  publishRelease(release, remote.execute);
  for (const alias of ['4.2', '4', 'latest']) assert.equal(remote.images.get(`${image}:${alias}`), digest);
  assert.deepEqual(
    remote.writes.map(([program]) => program),
    ['docker', 'gh'],
  );
  assert.deepEqual(remote.writes[1], [
    'gh',
    'api',
    '--method',
    'POST',
    'repos/example/BLEX/git/refs',
    '-f',
    'ref=refs/tags/v4.2',
    '-f',
    `sha=${sha}`,
  ]);
  assert.equal(remote.calls.filter(([, , , operation]) => operation === 'inspect').length, 5);
});

test('checks both architectures before changing any release tag', () => {
  const remote = registry({ missingArm: true });
  assert.throws(() => publishRelease(release, remote.execute), /AMD64 and ARM64/);
  assert.deepEqual(remote.writes, []);
});

test('rejects candidate digest substitution before publishing', () => {
  const remote = registry();
  remote.images.set(`${image}@${digest}`, otherDigest);
  assert.throws(() => publishRelease(release, remote.execute), /Candidate digest mismatch/);
  assert.deepEqual(remote.writes, []);
});

test('refuses to overwrite an existing Docker or Git version', () => {
  const remote = registry({ versionDigest: otherDigest });
  assert.throws(() => publishRelease(release, remote.execute), /another image/);
  assert.deepEqual(remote.writes, []);
  assert.throws(() => publishRelease({ ...release, existingTag: 'd'.repeat(40) }, remote.execute), /another commit/);
  assert.deepEqual(remote.writes, []);
});

test('stops on registry failures instead of treating them as absent version tags', () => {
  for (const inspectFailure of ['unauthorized', 'connection timed out', 'repository not found']) {
    const remote = registry({ inspectFailure });
    assert.throws(() => publishRelease(release, remote.execute), new RegExp(inspectFailure));
    assert.deepEqual(remote.writes, []);
  }
});

test('does not create a Git tag if a published alias has the wrong digest', () => {
  const remote = registry({ corruptAlias: `${image}:latest` });
  assert.throws(() => publishRelease(release, remote.execute), /Published digest mismatch: latest/);
  assert.deepEqual(
    remote.writes.map(([program]) => program),
    ['docker'],
  );
});

test('can retry failed Git tagging with the same image and skips an existing matching Git tag', () => {
  const failed = registry({ failTag: true });
  assert.throws(() => publishRelease(release, failed.execute), /Git tag publication failed/);
  assert.equal(failed.images.get(`${image}:4.2`), digest);
  const retry = registry({ versionDigest: digest });
  publishRelease(release, retry.execute);
  const complete = registry({ versionDigest: digest });
  publishRelease({ ...release, existingTag: sha }, complete.execute);
  assert.deepEqual(
    complete.writes.map(([program]) => program),
    ['docker'],
  );
});

test('rejects invalid candidate identifiers without calling external services', () => {
  const remote = registry();
  assert.throws(() => publishRelease({ ...release, digest: 'latest' }, remote.execute), /Invalid candidate digest/);
  assert.throws(() => publishRelease({ ...release, sha: 'main' }, remote.execute), /Invalid release commit/);
  assert.deepEqual(remote.calls, []);
});

test('rejects a single-platform manifest', () => {
  assert.throws(() => inspectImage(`${image}@${digest}`, registry({ missingArm: true }).execute), /AMD64 and ARM64/);
});

test('prepare fixes the dispatch commit and next version without creating a Git tag', () => {
  const directory = mkdtempSync(join(tmpdir(), 'blex-release-'));
  try {
    const origin = join(directory, 'origin.git');
    const checkout = join(directory, 'checkout');
    execFileSync('git', ['init', '--bare', origin], { stdio: 'pipe' });
    execFileSync('git', ['init', '-b', 'main', checkout], { stdio: 'pipe' });
    const git = (...args) => execFileSync('git', args, { cwd: checkout, encoding: 'utf8', stdio: 'pipe' }).trim();
    git('config', 'user.name', 'Release test');
    git('config', 'user.email', 'release@example.com');
    git('config', 'commit.gpgSign', 'false');
    git('config', 'tag.gpgSign', 'false');
    git('config', 'core.hooksPath', '/dev/null');
    git('remote', 'add', 'origin', origin);
    writeFileSync(join(checkout, 'package.json'), JSON.stringify({ version: '4.0.0' }));
    git('add', 'package.json');
    git('commit', '-m', 'Initial version');
    git('tag', 'v4.1');
    git('commit', '--allow-empty', '-m', 'Release candidate');
    git('push', 'origin', 'main', '--tags');
    const target = git('rev-parse', 'HEAD');
    const output = join(directory, 'outputs');
    const script = fileURLToPath(new URL('./release.mjs', import.meta.url));
    const env = {
      ...process.env,
      RELEASE_VERSION: '',
      GITHUB_REF: 'refs/heads/main',
      GITHUB_SHA: target,
      GITHUB_OUTPUT: output,
    };
    const prepare = spawnSync(process.execPath, [script, 'prepare'], { cwd: checkout, env, encoding: 'utf8' });
    assert.equal(prepare.status, 0, prepare.stderr);
    assert.equal(readFileSync(output, 'utf8'), `version=4.2\nsha=${target}\n`);
    assert.equal(git('tag', '--list'), 'v4.1');
    assert.equal(git('ls-remote', '--tags', 'origin').split('\n').length, 1);
    const wrongBranch = spawnSync(process.execPath, [script, 'prepare'], {
      cwd: checkout,
      env: { ...env, GITHUB_REF: 'refs/heads/feature' },
      encoding: 'utf8',
    });
    assert.equal(wrongBranch.status, 1);
    assert.match(wrongBranch.stderr, /Run releases from main/);
    const wrongCommit = spawnSync(process.execPath, [script, 'prepare'], {
      cwd: checkout,
      env: { ...env, GITHUB_SHA: sha },
      encoding: 'utf8',
    });
    assert.equal(wrongCommit.status, 1);
    assert.match(wrongCommit.stderr, /Checkout does not match/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
