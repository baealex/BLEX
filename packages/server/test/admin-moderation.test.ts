import assert from 'node:assert/strict';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { createPasswordResetToken } from '../src/features/auth/password-reset.js';
import { hashPassword } from '../src/features/auth/password-hash.js';
import {
  createMigratedDatabase, insertRow, seedEditor, seedPost, signIn, testCipherKey, testSecretKey, testSiteUrl,
} from './fixtures/migrated-database.js';

const newPassword = 'Tr0ub4dor&3-horse-staple';

type Fixture = Awaited<ReturnType<typeof createMigratedDatabase>>;

async function withApp(run: (context: {
  fixture: Fixture;
  app: Awaited<ReturnType<typeof buildApp>>;
  owner: Record<string, string>;
  staff: Record<string, string>;
  reader: Record<string, string>;
}) => Promise<void>) {
  const fixture = await createMigratedDatabase();
  const { db } = fixture;
  insertRow(db, 'User', { id: 1, username: 'owner', passwordHash: 'pbkdf2_sha256$fixture$owner', isActive: 1, isStaff: 1, isSuperuser: 1 });
  insertRow(db, 'Profile', { userId: 1, role: 'EDITOR' });
  insertRow(db, 'User', { id: 2, username: 'moderator', passwordHash: 'pbkdf2_sha256$fixture$moderator', isActive: 1, isStaff: 1 });
  insertRow(db, 'Profile', { userId: 2, role: 'EDITOR' });
  seedEditor(db, 3, 'writer');
  insertRow(db, 'User', { id: 4, username: 'reader', passwordHash: 'pbkdf2_sha256$fixture$reader', isActive: 1 });
  insertRow(db, 'Profile', { userId: 4, role: 'READER' });
  insertRow(db, 'User', { id: 5, username: 'other-owner', passwordHash: 'pbkdf2_sha256$fixture$other', isActive: 1, isStaff: 1, isSuperuser: 1 });
  seedPost(db, 10, 3, 'public-post', { title: 'Public post' });
  seedPost(db, 11, 3, 'draft-post', { title: 'Private draft', publishedAt: null });
  seedPost(db, 12, 3, 'scheduled-post', { title: 'Private schedule', publishedAt: Date.now() + 86_400_000 });
  const owner = signIn(db, 1);
  const staff = signIn(db, 2);
  const reader = signIn(db, 4);
  const app = await buildApp(fixture.path, testSiteUrl, { secretKey: testSecretKey, cipherKey: testCipherKey }, fixture.mediaRoot);
  try {
    await run({ fixture, app, owner, staff, reader });
  } finally {
    await app.close();
    await fixture.cleanup();
  }
}

const json = (headers: Record<string, string>) => ({ ...headers, 'content-type': 'application/json' });
const parsed = (response: { body: string }) => JSON.parse(response.body) as { status: string; errorCode?: string; body: any };

test('staff hide, trash, and restore published posts without seeing drafts', async () => {
  await withApp(async ({ app, staff, reader, fixture }) => {
    assert.equal(parsed(await app.inject({ url: '/v1/admin/posts', headers: reader })).errorCode, 'error:RJ');

    const list = parsed(await app.inject({ url: '/v1/admin/posts', headers: staff }));
    assert.deepEqual(list.body.posts.map((post: { title: string }) => post.title), ['Public post']);
    const search = parsed(await app.inject({ url: '/v1/admin/posts?q=Private', headers: staff }));
    assert.equal(search.body.posts.length, 0);

    const noCsrf = await app.inject({
      method: 'PATCH', url: '/v1/admin/posts/10', headers: { cookie: staff.cookie, 'content-type': 'application/json' },
      payload: JSON.stringify({ isHidden: true }),
    });
    assert.equal(noCsrf.statusCode, 403);
    const denied = await app.inject({ method: 'POST', url: '/v1/admin/posts/10/trash', headers: reader });
    assert.equal(parsed(denied).errorCode, 'error:RJ');
    const draft = await app.inject({ method: 'POST', url: '/v1/admin/posts/11/trash', headers: staff });
    assert.equal(parsed(draft).errorCode, 'error:NF');

    assert.equal((await app.inject('/@writer/public-post')).statusCode, 200);
    const before = fixture.db.prepare('SELECT updatedAt FROM "Post" WHERE id = 10').get() as { updatedAt: number };
    const hidden = await app.inject({
      method: 'PATCH', url: '/v1/admin/posts/10', headers: json(staff), payload: JSON.stringify({ isHidden: true }),
    });
    assert.equal(parsed(hidden).body.status, 'hidden');
    assert.equal((await app.inject('/@writer/public-post')).statusCode, 404);
    assert.deepEqual({ ...fixture.db.prepare('SELECT updatedAt FROM "Post" WHERE id = 10').get() }, { ...before });

    await app.inject({ method: 'PATCH', url: '/v1/admin/posts/10', headers: json(staff), payload: JSON.stringify({ isHidden: false }) });
    assert.equal((await app.inject('/@writer/public-post')).statusCode, 200);

    const trashed = await app.inject({ method: 'POST', url: '/v1/admin/posts/10/trash', headers: staff });
    assert.equal(parsed(trashed).body.status, 'trash');
    assert.equal((await app.inject('/@writer/public-post')).statusCode, 404);
    const trashList = parsed(await app.inject({ url: '/v1/admin/posts?status=trash', headers: staff }));
    assert.equal(trashList.body.posts.length, 1);

    const restored = await app.inject({ method: 'POST', url: '/v1/admin/posts/10/restore', headers: staff });
    assert.equal(parsed(restored).body.status, 'public');
    assert.equal((await app.inject('/@writer/public-post')).statusCode, 200);
    const logged = fixture.db.prepare(`SELECT COUNT(*) AS total FROM "AdminLog" WHERE target = 'post' AND userId = 2`).get() as { total: number };
    assert.equal(logged.total, 4);
  });
});

test('staff delete a comment and the audit log keeps no comment text', async () => {
  await withApp(async ({ app, staff, reader, fixture }) => {
    insertRow(fixture.db, 'Comment', { id: 20, postId: 10, authorId: 4, markdown: 'buy spam now', html: '<p>buy spam now</p>' });
    insertRow(fixture.db, 'Comment', { id: 21, postId: 10, authorId: null, markdown: 'already removed', html: '<p>already removed</p>' });

    const list = parsed(await app.inject({ url: '/v1/admin/comments', headers: staff }));
    assert.deepEqual(list.body.comments.map((comment: { id: number }) => comment.id), [20]);
    assert.equal(list.body.comments[0].excerpt, 'buy spam now');
    assert.equal(list.body.comments[0].postPath, '/@writer/public-post');

    assert.equal(parsed(await app.inject({ method: 'DELETE', url: '/v1/admin/comments/20', headers: reader })).errorCode, 'error:RJ');
    assert.equal(parsed(await app.inject({ method: 'DELETE', url: '/v1/admin/comments/21', headers: staff })).errorCode, 'error:NF');
    assert.equal(parsed(await app.inject({ method: 'DELETE', url: '/v1/admin/comments/20', headers: staff })).status, 'DONE');

    assert.deepEqual({ ...fixture.db.prepare('SELECT authorId FROM "Comment" WHERE id = 20').get() }, { authorId: null });
    assert.doesNotMatch((await app.inject('/@writer/public-post')).body, /buy spam now/);
    const audit = fixture.db.prepare(`SELECT objectName, message FROM "AdminLog" WHERE target = 'comment'`).all();
    assert.equal(audit.length, 1);
    assert.doesNotMatch(JSON.stringify(audit), /spam/);
  });
});

test('deactivation signs a member out and only applies to non-administrators', async () => {
  await withApp(async ({ app, staff, owner, fixture }) => {
    const writer = signIn(fixture.db, 3);
    const setStatus = (id: number, isActive: boolean, headers = staff) => app.inject({
      method: 'PATCH', url: `/v1/admin/users/${id}/status`, headers: json(headers), payload: JSON.stringify({ isActive }),
    });

    assert.equal(parsed(await setStatus(1, false)).errorCode, 'error:RJ');
    assert.equal(parsed(await setStatus(2, false)).errorCode, 'error:RJ');
    assert.equal(parsed(await setStatus(5, false, owner)).errorCode, 'error:RJ');

    const off = parsed(await setStatus(3, false));
    assert.equal(off.body.user.isActive, false);
    assert.equal(off.body.user.canChangeRole, false);
    assert.equal(off.body.user.canChangeStatus, true);
    const sessions = fixture.db.prepare('SELECT COUNT(*) AS total FROM "Session" WHERE userId = 3').get() as { total: number };
    assert.equal(sessions.total, 0);
    assert.equal(parsed(await app.inject({ url: '/v1/login', headers: writer })).errorCode, 'error:NL');
    assert.equal((await app.inject('/@writer/public-post')).statusCode, 404);

    assert.equal(parsed(await setStatus(3, true)).body.user.isActive, true);
    assert.equal((await app.inject('/@writer/public-post')).statusCode, 200);
  });
});

test('only a superuser deletes a member, after typing the username', async () => {
  await withApp(async ({ app, staff, owner, fixture }) => {
    insertRow(fixture.db, 'Comment', { id: 20, postId: 10, authorId: 4, markdown: 'hello', html: '<p>hello</p>' });
    seedPost(fixture.db, 13, 4, 'reader-post');
    const remove = (id: number, username: string, headers = owner) => app.inject({
      method: 'DELETE', url: `/v1/admin/users/${id}`, headers: json(headers), payload: JSON.stringify({ username }),
    });

    assert.equal(parsed(await remove(4, 'reader', staff)).errorCode, 'error:RJ');
    assert.equal(parsed(await remove(4, 'wrong')).errorCode, 'error:VA');
    assert.equal(parsed(await remove(1, 'owner')).errorCode, 'error:RJ');
    assert.equal(parsed(await remove(2, 'moderator')).errorCode, 'error:RJ');

    assert.equal(parsed(await remove(4, 'reader')).body.username, 'reader');
    assert.equal(fixture.db.prepare('SELECT id FROM "User" WHERE id = 4').get(), undefined);
    assert.equal(fixture.db.prepare('SELECT id FROM "Post" WHERE id = 13').get(), undefined);
    assert.deepEqual({ ...fixture.db.prepare('SELECT authorId FROM "Comment" WHERE id = 20').get() }, { authorId: null });
    const audit = fixture.db.prepare(`SELECT objectName FROM "AdminLog" WHERE target = 'user' AND action = 3`).all();
    assert.deepEqual(audit.map((row) => ({ ...row })), [{ objectName: 'reader' }]);
  });
});

test('only a superuser turns off another member\'s two-factor authentication', async () => {
  await withApp(async ({ app, staff, owner, fixture }) => {
    const member = signIn(fixture.db, 3);
    for (const [id, userId] of [[1, 3], [2, 5]]) insertRow(fixture.db, 'TwoFactorAuth', { id, userId, totpSecret: 'x', recoveryKey: 'y' });

    const listed = parsed(await app.inject({ url: '/v1/admin/users?q=writer', headers: owner }));
    assert.equal(listed.body.users[0].hasTwoFactor, true);
    assert.equal(listed.body.users[0].canResetTwoFactor, true);
    const asStaff = parsed(await app.inject({ url: '/v1/admin/users?q=writer', headers: staff }));
    assert.equal(asStaff.body.users[0].canResetTwoFactor, false);

    assert.equal(parsed(await app.inject({ method: 'DELETE', url: '/v1/admin/users/3/two-factor', headers: staff })).errorCode, 'error:RJ');
    assert.equal(parsed(await app.inject({ method: 'DELETE', url: '/v1/admin/users/5/two-factor', headers: owner })).errorCode, 'error:RJ');
    const reset = parsed(await app.inject({ method: 'DELETE', url: '/v1/admin/users/3/two-factor', headers: owner }));
    assert.equal(reset.body.user.hasTwoFactor, false);
    assert.equal(parsed(await app.inject({ url: '/v1/login', headers: member })).errorCode, 'error:NL');
    assert.notEqual(fixture.db.prepare('SELECT id FROM "TwoFactorAuth" WHERE userId = 5').get(), undefined);
  });
});

test('a password link works once, keeps two-factor, and is never logged', async () => {
  await withApp(async ({ app, staff, owner, fixture }) => {
    const oldHash = await hashPassword('Old-Passw0rd!-value');
    fixture.db.prepare('UPDATE "User" SET passwordHash = ? WHERE id = 3').run(oldHash);
    const member = signIn(fixture.db, 3);
    insertRow(fixture.db, 'TwoFactorAuth', { id: 1, userId: 3, totpSecret: 'x', recoveryKey: 'y' });

    assert.equal(parsed(await app.inject({ method: 'POST', url: '/v1/admin/users/3/password-link', headers: staff })).errorCode, 'error:RJ');
    assert.equal(parsed(await app.inject({ method: 'POST', url: '/v1/admin/users/5/password-link', headers: owner })).errorCode, 'error:RJ');
    const issued = parsed(await app.inject({ method: 'POST', url: '/v1/admin/users/3/password-link', headers: owner }));
    const link = new URL(issued.body.url);
    assert.equal(link.origin, testSiteUrl.origin);
    assert.ok(new Date(issued.body.expiresDate).getTime() > Date.now());
    assert.doesNotMatch(JSON.stringify(fixture.db.prepare('SELECT * FROM "AdminLog"').all()), new RegExp(link.pathname.split('/').at(-1)!.replaceAll('.', '\\.')));

    const page = await app.inject(link.pathname);
    assert.equal(page.statusCode, 200);
    assert.equal(page.headers['referrer-policy'], 'no-referrer');
    assert.match(String(page.headers['cache-control']), /no-store/);
    assert.match(page.body, /writer/);

    const csrf = 'c'.repeat(43);
    const submit = (password: string, confirm = password) => app.inject({
      method: 'POST', url: link.pathname,
      headers: { origin: testSiteUrl.origin, cookie: `csrftoken=${csrf}`, 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams({ csrfmiddlewaretoken: csrf, password, passwordConfirm: confirm }).toString(),
    });
    const forged = await app.inject({
      method: 'POST', url: link.pathname, headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams({ password: newPassword, passwordConfirm: newPassword }).toString(),
    });
    assert.equal(forged.statusCode, 403);
    assert.match((await submit(newPassword, 'different')).body, /일치하지 않습니다/);
    assert.match((await submit('short')).body, /role="alert"/);
    const unchanged = fixture.db.prepare('SELECT passwordHash FROM "User" WHERE id = 3').get() as { passwordHash: string };
    assert.equal(unchanged.passwordHash, oldHash);

    const saved = await submit(newPassword);
    assert.equal(saved.statusCode, 200);
    assert.match(saved.body, /저장했습니다/);
    const changed = fixture.db.prepare('SELECT passwordHash FROM "User" WHERE id = 3').get() as { passwordHash: string };
    assert.notEqual(changed.passwordHash, oldHash);
    assert.equal(parsed(await app.inject({ url: '/v1/login', headers: member })).errorCode, 'error:NL');
    assert.notEqual(fixture.db.prepare('SELECT id FROM "TwoFactorAuth" WHERE userId = 3').get(), undefined);

    assert.equal((await app.inject(link.pathname)).statusCode, 404);
    assert.equal((await submit('An0ther!-Passw0rd-value')).statusCode, 404);
  });
});

test('a password link stops working when it expires, is altered, or the member is deactivated', async () => {
  await withApp(async ({ app, fixture }) => {
    const prisma = new PrismaClient({ datasources: { db: { url: `file:${fixture.path}` } } });
    try {
      const account = await prisma.user.findUniqueOrThrow({ where: { id: 3 }, select: { id: true, passwordHash: true } });
      const expired = createPasswordResetToken(account, testSecretKey, Date.now() - 25 * 60 * 60 * 1_000).token;
      assert.equal((await app.inject(`/password-reset/${expired}`)).statusCode, 404);
      const valid = createPasswordResetToken(account, testSecretKey).token;
      const [id, expiresAt, signature] = valid.split('.');
      assert.equal((await app.inject(`/password-reset/4.${expiresAt}.${signature}`)).statusCode, 404);
      assert.equal((await app.inject(`/password-reset/${id}.${Number(expiresAt) + 1000}.${signature}`)).statusCode, 404);
      assert.equal((await app.inject(`/password-reset/${createPasswordResetToken(account, 'another-secret').token}`)).statusCode, 404);
      assert.equal((await app.inject(`/password-reset/${valid}`)).statusCode, 200);
      fixture.db.prepare('UPDATE "User" SET isActive = 0 WHERE id = 3').run();
      assert.equal((await app.inject(`/password-reset/${valid}`)).statusCode, 404);
    } finally {
      await prisma.$disconnect();
    }
  });
});
