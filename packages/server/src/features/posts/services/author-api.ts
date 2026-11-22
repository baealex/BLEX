import { type PrismaClient } from '@prisma/client';
import { descriptionFromHtml, mediaUrl, parseAuthoringPostInput, resolveContent } from './post-content.js';
import { AuthoringSaveResult, PostValidationError, assertExpectedUpdatedAt, createPost, draftReservation, loadPost, postTags, trashPost, updatePost } from './post-store.js';
import { AuthoringPostInput, AuthoringUser, StoredPost, UserRow, dateAsIso, numberValue } from '../shared.js';

export function apiPostBase(post: StoredPost, contentHtml: string): Record<string, unknown> {
  return {
    image: mediaUrl(post.image),
    title: post.title,
    subtitle: post.subtitle,
    url: post.url,
    description: post.description,
    publishedDate: dateAsIso(post.publishedDate),
    updatedDate: dateAsIso(post.updatedDate),
    isScheduled: Boolean(post.publishedDate && post.publishedDate.valueOf() > Date.now()),
    series: post.seriesId !== null && post.seriesUrl
      ? { id: String(post.seriesId), name: post.seriesName ?? '', url: post.seriesUrl }
      : null,
    contentHtml,
    textHtml: contentHtml,
    isHide: post.hide,
    isAdvertise: post.advertise,
    blockComment: post.blockComment,
    coverLayout: post.coverLayout,
    coverImagePosition: post.coverImagePosition,
    coverImageRatio: post.coverImageRatio,
  };
}

function hasPostContent(body: Record<string, unknown>): boolean {
  return ['contentHtml', 'content', 'textHtml', 'textMd', 'contentMarkdown', 'markdown']
    .some((key) => Object.hasOwn(body, key));
}

export async function preservePostOmissions(
  db: PrismaClient,
  post: StoredPost,
  body: Record<string, unknown>,
  input: AuthoringPostInput,
): Promise<AuthoringPostInput> {
  const hasText = hasPostContent(body);
  const tags = await postTags(db, post.id);
  const isScheduled = Boolean(post.publishedDate && post.publishedDate.valueOf() > Date.now());
  const reservedDate = Object.hasOwn(body, 'reservedDate')
    ? input.reservedDate
    : post.publishedDate === null
      ? await draftReservation(db, post.id)
      : isScheduled ? dateAsIso(post.publishedDate) ?? '' : '';
  return {
    ...input,
    title: Object.hasOwn(body, 'title') ? input.title : post.title,
    subtitle: Object.hasOwn(body, 'subtitle') ? input.subtitle : post.subtitle,
    text: hasText ? input.text : '',
    description: Object.hasOwn(body, 'description') || Object.hasOwn(body, 'metaDescription')
      ? input.description
      : hasText ? descriptionFromHtml(resolveContent(input)) : post.description,
    url: Object.hasOwn(body, 'customUrl') || Object.hasOwn(body, 'url') ? input.url : post.url,
    tags: Object.hasOwn(body, 'tags') || Object.hasOwn(body, 'tag') ? input.tags : tags.join(','),
    series: Object.hasOwn(body, 'seriesUrl') || Object.hasOwn(body, 'series') ? input.series : post.seriesUrl ?? '',
    hide: Object.hasOwn(body, 'isHide') || Object.hasOwn(body, 'hide') ? input.hide : post.hide,
    advertise: Object.hasOwn(body, 'isAdvertise') || Object.hasOwn(body, 'advertise') ? input.advertise : post.advertise,
    blockComment: Object.hasOwn(body, 'blockComment') ? input.blockComment : post.blockComment,
    coverLayout: Object.hasOwn(body, 'coverLayout') ? input.coverLayout : post.coverLayout,
    coverImagePosition: Object.hasOwn(body, 'coverImagePosition') ? input.coverImagePosition : post.coverImagePosition,
    coverImageRatio: Object.hasOwn(body, 'coverImageRatio') ? input.coverImageRatio : post.coverImageRatio,
    reservedDate,
  };
}

async function verifiedEditor(db: PrismaClient, editor: AuthoringUser): Promise<UserRow> {
  const rows = await db.$queryRaw<UserRow[]>`
    SELECT author.id AS id, author.username AS username,
           CAST(author.is_active AS INTEGER) AS isActive, profile.role AS role
      FROM auth_user AS author
      LEFT JOIN board_profile AS profile ON profile.user_id = author.id
     WHERE author.id = ${editor.id} AND author.username = ${editor.username}
     LIMIT 1
  `;
  const author = rows[0];
  if (!author || numberValue(author.isActive) !== 1 || author.role !== 'EDITOR') {
    throw new PostValidationError('RJ', 'Author access is required.');
  }
  return author;
}

async function ownedPostByReference(
  db: PrismaClient,
  author: UserRow,
  reference: string | number,
): Promise<StoredPost> {
  let slug: string;
  if (typeof reference === 'number') {
    if (!Number.isSafeInteger(reference) || reference < 1) throw new PostValidationError('VA', 'Check the post ID.');
    const row = await db.post.findFirst({ where: { id: reference, authorId: author.id, deletedAt: null }, select: { slug: true } });
    slug = row?.slug ?? '';
  } else {
    slug = reference;
  }
  const post = slug ? await loadPost(db, { userId: author.id, slug }) : null;
  if (!post) throw new PostValidationError('RJ', 'The post was not found.');
  return post;
}

/**
 * Create a post with the same persistence and sanitization path as `/v1/posts`.
 * Accepted body fields include title, subtitle, content/textMd/contentMarkdown,
 * contentType, description/metaDescription, url/customUrl, tags/tag, series,
 * hide/isHide, advertise/isAdvertise, blockComment, cover settings and reservedDate.
 */
export async function createAuthorPost(
  db: PrismaClient,
  editor: AuthoringUser,
  body: Record<string, unknown>,
  asDraft = false,
): Promise<AuthoringSaveResult> {
  const author = await verifiedEditor(db, editor);
  return createPost(db, author, parseAuthoringPostInput(body), asDraft);
}

/** Update an owned post using PATCH semantics and an optional optimistic timestamp. */
export async function updateAuthorPost(
  db: PrismaClient,
  editor: AuthoringUser,
  reference: string | number,
  body: Record<string, unknown>,
  expectedUpdatedAt?: string,
): Promise<AuthoringSaveResult> {
  const author = await verifiedEditor(db, editor);
  const post = await ownedPostByReference(db, author, reference);
  assertExpectedUpdatedAt(post.updatedDate, expectedUpdatedAt);
  const input = await preservePostOmissions(db, post, body, parseAuthoringPostInput(body));
  const isDraft = post.publishedDate === null;
  const hasContent = hasPostContent(body);
  if (!isDraft && Object.hasOwn(body, 'title') && !input.title) throw new PostValidationError('VA', 'Enter a title.');
  if (!isDraft && hasContent && !input.text.trim()) throw new PostValidationError('VA', 'Enter some content.');
  return updatePost(db, author, post, input, {
    allowEmptyBody: isDraft || !hasContent,
    clearContent: isDraft && hasContent && !input.text,
    updateDraft: isDraft,
    preserveTags: !Object.hasOwn(body, 'tags') && !Object.hasOwn(body, 'tag'),
    expectedUpdatedDate: expectedUpdatedAt === undefined ? undefined : post.updatedDate,
  });
}

/** Publish an owned draft, preserving omitted fields and optionally scheduling it. */
export async function publishAuthorDraft(
  db: PrismaClient,
  editor: AuthoringUser,
  reference: string | number,
  body: Record<string, unknown> = {},
  expectedUpdatedAt?: string,
): Promise<AuthoringSaveResult> {
  const author = await verifiedEditor(db, editor);
  const post = await ownedPostByReference(db, author, reference);
  if (post.publishedDate !== null) throw new PostValidationError('RJ', 'Only drafts can be published here.');
  assertExpectedUpdatedAt(post.updatedDate, expectedUpdatedAt);
  const input = await preservePostOmissions(db, post, body, parseAuthoringPostInput(body));
  if (!input.text) {
    input.text = post.contentHtml;
    input.contentType = 'html';
  }
  return updatePost(db, author, post, input, {
    allowEmptyBody: false,
    publishDraft: true,
    preserveTags: !Object.hasOwn(body, 'tags') && !Object.hasOwn(body, 'tag'),
    expectedUpdatedDate: expectedUpdatedAt === undefined ? undefined : post.updatedDate,
  });
}

/** Soft-delete an owned post, optionally rejecting a stale `updated_at` value. */
export async function deleteAuthorPost(
  db: PrismaClient,
  editor: AuthoringUser,
  reference: string | number,
  expectedUpdatedAt?: string,
): Promise<{ id: number; url: string; deletedDate: string }> {
  const author = await verifiedEditor(db, editor);
  const post = await ownedPostByReference(db, author, reference);
  assertExpectedUpdatedAt(post.updatedDate, expectedUpdatedAt);
  const deletedDate = await trashPost(db, author, post, expectedUpdatedAt === undefined ? undefined : post.updatedDate);
  return { id: post.id, url: post.url, deletedDate };
}
