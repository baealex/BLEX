import assert from 'node:assert/strict';
import test from 'node:test';
import { buildApp } from '../src/app.js';
import { sanitizeCommentHtml } from '../src/features/posts/post-html.js';
import { timeSince } from '../src/features/engagement/index.js';
import {
  appendCommentToTree,
  buildReplySubmissionText,
  commentAuthors,
  countComments,
  findRootParentId,
  isMentionQuery,
  isMentionStart,
  mergeCommentInTree,
} from './support/comment-model.js';
import type { CommentPayload } from '../src/features/engagement/index.js';
import {
  createMigratedDatabase,
  insertRow,
  seedEditor,
  seedPost,
  signIn,
  testCipherKey,
  testSecretKey,
  testSiteUrl,
  prismaDate,
} from './fixtures/migrated-database.js';

const recent = new Date(Date.now() - 3_600_000).toISOString().slice(0, -1).replace('T', ' ');
const comment = (id: number, author: string, extra: Partial<CommentPayload> = {}): CommentPayload => ({
  id,
  author,
  authorImage: null,
  isMine: false,
  isEdited: false,
  isDeleted: false,
  renderedContent: '<p>c</p>',
  createdDate: '1시간 전',
  countLikes: 0,
  isLiked: false,
  permissions: { canEdit: false, canDelete: false, canLike: false, canReply: true },
  ...extra,
});

async function commentsApp() {
  const fixture = await createMigratedDatabase();
  const { db } = fixture;
  seedEditor(db, 1, 'writer');
  seedEditor(db, 2, 'reader');
  insertRow(db, 'SiteSetting', { id: 1, seoEnabled: 1, aeoEnabled: 1 });
  seedPost(db, 1, 1, 'open-post', { title: 'Open post', publishedAt: recent });
  insertRow(db, 'Comment', {
    id: 10,
    postId: 1,
    authorId: 1,
    markdown: 'root',
    html: '<p>root</p>',
    createdAt: prismaDate(recent),
  });
  insertRow(db, 'Comment', {
    id: 11,
    postId: 1,
    authorId: 2,
    parentId: 10,
    markdown: 'reply',
    html: '<p>reply</p>',
    createdAt: prismaDate(recent),
  });
  const app = await buildApp(
    fixture.path,
    testSiteUrl,
    { secretKey: testSecretKey, cipherKey: testCipherKey },
    fixture.mediaRoot,
  );
  await app.ready();
  return {
    ...fixture,
    app,
    async close() {
      await app.close();
      await fixture.cleanup();
    },
  };
}

test('applies the 3.x mention and reply text rules', () => {
  assert.equal(isMentionStart('hello @', 6), true);
  assert.equal(isMentionStart('mail@', 4), false);
  assert.equal(isMentionQuery('abc123'), true);
  assert.equal(isMentionQuery('abc def'), false);
  assert.equal(buildReplySubmissionText('  hello ', 'writer'), '@writer hello');
  assert.equal(buildReplySubmissionText('@writer, hello', 'writer'), '@writer, hello');
  assert.equal(buildReplySubmissionText('@writerfoo hi', 'writer'), '@writer @writerfoo hi');
});

test('keeps replies one level deep in the comment tree', () => {
  const tree = [
    comment(1, 'a', { replies: [comment(2, 'b', { parentId: 1 })] }),
    comment(3, 'Ghost', { isDeleted: true }),
  ];
  assert.equal(findRootParentId(2, tree), 1);
  assert.deepEqual(commentAuthors(tree), ['a', 'b']);
  const appended = appendCommentToTree(tree, comment(4, 'c', { parentId: 1 }));
  assert.deepEqual(
    appended[0].replies?.map((reply: { id: number }) => reply.id),
    [2, 4],
  );
  assert.equal(countComments(appended), 4);
  assert.equal(
    mergeCommentInTree(appended, comment(2, 'Ghost', { parentId: 1, isDeleted: true }))[0].replies?.[0].isDeleted,
    true,
  );
});

test('formats comment dates like the 3.x Korean interface', () => {
  const now = new Date('2026-11-22T12:00:00.000Z');
  const ago = (ms: number) => new Date(now.valueOf() - ms).toISOString();
  assert.equal(timeSince(ago(5_000), now), '0분 전');
  assert.equal(timeSince(ago(5 * 60_000), now), '5분 전');
  assert.equal(timeSince(ago(3 * 3_600_000), now), '3시간 전');
  assert.equal(timeSince(ago(2 * 86_400_000), now), '2일 전');
  assert.equal(timeSince(ago(9 * 86_400_000), now), '1주 전');
  assert.equal(timeSince(ago(40 * 86_400_000), now), '1개월 전');
  assert.equal(timeSince('2019-09-20 03:00:00', now), '2019년 9월 20일');
});

test('keeps the narrower 3.x allowlist for stored comment HTML', () => {
  const html = sanitizeCommentHtml(
    '<ol start="2" style="color:red"><li class="task-list-item bad">x</li></ol><a class="mention bad" href="/@a">@a</a><script>x()</script>',
  );
  assert.equal(html, '<ol><li class="task-list-item">x</li></ol><a class="mention" href="/@a">@a</a>');
});

test('accepts a long Korean comment and rejects replies under a reply', async () => {
  const fixture = await commentsApp();
  try {
    const headers = { ...signIn(fixture.db, 2), 'content-type': 'application/x-www-form-urlencoded' };
    const text = '가'.repeat(5_000);
    const long = await fixture.app.inject({
      method: 'POST',
      url: '/v1/comments?url=open-post',
      headers,
      payload: new URLSearchParams({ commentMd: text }).toString(),
    });
    assert.equal(long.statusCode, 200, long.body);
    assert.equal(long.json().status, 'DONE');
    const rootReply = await fixture.app.inject({
      method: 'POST',
      url: '/v1/comments?url=open-post',
      headers,
      payload: 'commentMd=hi&parentId=10',
    });
    assert.equal(rootReply.json().body.parentId, 10);
    const nested = await fixture.app.inject({
      method: 'POST',
      url: '/v1/comments?url=open-post',
      headers,
      payload: 'commentMd=hi&parentId=11',
    });
    assert.equal(nested.json().status, 'ERROR');
  } finally {
    await fixture.close();
  }
});

test('renders the comment application with 3.x login and owner controls', async () => {
  const fixture = await commentsApp();
  try {
    const anonymous = (await fixture.app.inject('/@writer/open-post')).body;
    assert.ok(anonymous.includes('data-blex-post-comments'));
    assert.ok(anonymous.includes('id="blex-post-page-data"'));
    assert.ok(
      anonymous.includes('data-blex-login-next="/@writer/open-post?reply_to=11#post-comments"'),
      'a reply can target another reply',
    );
    assert.match(anonymous, /댓글을 작성하세요\.\.\./);
    assert.doesNotMatch(anonymous, /aria-label="댓글 옵션 열기"/);
    const owner = (await fixture.app.inject({ url: '/@writer/open-post', headers: signIn(fixture.db, 2) })).body;
    assert.match(owner, /aria-label="댓글 옵션 열기"/);
    assert.match(owner, /action="\/v1\/comments\?url=open-post"/);
    assert.doesNotMatch(owner, /name="action" value="delete"/);
  } finally {
    await fixture.close();
  }
});
