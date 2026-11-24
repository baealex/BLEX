import type { FastifyRequest } from 'fastify';
import type { Prisma, PrismaClient } from '@prisma/client';
import { storedDateText } from '../../../platform/date-format.js';
import { postIdsMatching } from '../../posts/data/text-match.js';
import { publicPostWhere } from '../../posts/data/visibility.js';
import { readableDescription } from '../../posts/shared.js';
import { type AuthorRow, PAGE_SIZE, type PostQueryOptions, type PostRow, type PublicPageViewer } from '../shared.js';
import { csrfCookie } from '../page-context.js';
import type { CardLikes } from '@blex/contracts/public';

const postCardSelect = {
  id: true,
  slug: true,
  title: true,
  subtitle: true,
  image: true,
  readTime: true,
  description: true,
  publishedAt: true,
  author: { select: { username: true, profile: { select: { avatar: true } } } },
  series: { select: { slug: true, name: true, isHidden: true } },
  _count: { select: { likes: true, comments: true } },
} satisfies Prisma.PostSelect;

type PostCard = Prisma.PostGetPayload<{ select: typeof postCardSelect }>;

function postCard(post: PostCard): PostRow {
  const series = post.series && !post.series.isHidden ? post.series : null;
  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    subtitle: post.subtitle,
    image: post.image,
    readTime: post.readTime,
    description: readableDescription(post.description),
    publishedDate: post.publishedAt && storedDateText(post.publishedAt),
    authorUsername: post.author.username,
    authorAvatar: post.author.profile?.avatar ?? null,
    likeCount: post._count.likes,
    commentCount: post._count.comments,
    seriesUrl: series?.slug ?? null,
    seriesName: series?.name ?? null,
  };
}

export async function readCardLikes(
  db: PrismaClient,
  request: FastifyRequest,
  viewer: PublicPageViewer | null,
  posts: PostRow[],
): Promise<CardLikes> {
  const liked =
    viewer && posts.length
      ? await db.postLike.findMany({
          where: { userId: viewer.id, postId: { in: posts.map((post) => post.id) } },
          select: { postId: true },
        })
      : [];
  return {
    csrfToken: viewer ? csrfCookie(request) : '',
    returnTo: request.url,
    likedIds: new Set(liked.map(({ postId }) => postId)),
  };
}

export async function readFeaturedPosts(
  db: PrismaClient,
  author: AuthorRow,
): Promise<{ kind: 'featured' | 'recent'; posts: PostRow[] }> {
  const pinned = await db.pinnedPost.findMany({
    where: { userId: author.id, post: publicPostWhere() },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }, { postId: 'asc' }],
    take: 6,
    select: {
      user: { select: { username: true, profile: { select: { avatar: true } } } },
      post: { select: postCardSelect },
    },
  });
  if (pinned.length) {
    return {
      kind: 'featured',
      posts: pinned.map(({ user, post }) => ({
        ...postCard(post),
        authorUsername: user.username,
        authorAvatar: user.profile?.avatar ?? null,
      })),
    };
  }
  const recent = await readPublicPosts(db, { where: { authorId: author.id }, limit: 6 });
  return { kind: 'recent', posts: recent };
}

export async function readPublicPostCount(db: PrismaClient, where: Prisma.PostWhereInput = {}): Promise<number> {
  return db.post.count({ where: { AND: [publicPostWhere(), where] } });
}

export async function readPublicPosts(db: PrismaClient, options: PostQueryOptions = {}): Promise<PostRow[]> {
  const rows = await db.post.findMany({
    where: { AND: [publicPostWhere(), options.where ?? {}] },
    orderBy: options.orderBy ?? [{ publishedAt: 'desc' }, { id: 'desc' }],
    take: options.limit ?? PAGE_SIZE,
    skip: options.offset ?? 0,
    select: postCardSelect,
  });
  return rows.map(postCard);
}

/** A reader's liked public posts, most recently liked first. */
export async function readLikedPosts(
  db: PrismaClient,
  userId: number,
  limit: number,
  offset: number,
): Promise<PostRow[]> {
  const likes = await db.postLike.findMany({
    where: { userId, post: publicPostWhere() },
    orderBy: [{ createdAt: 'desc' }, { post: { publishedAt: 'desc' } }],
    take: limit,
    skip: offset,
    select: { post: { select: postCardSelect } },
  });
  return likes.map(({ post }) => postCard(post));
}

export interface SearchMatch {
  id: number;
  publishedAt: Date;
  titleScore: number;
  descriptionScore: number;
  tagScore: number;
  contentScore: number;
  relevance: number;
}

/** Ranks every match using ids and dates only, so a broad search never loads post bodies into memory. */
export async function rankPublicSearch(db: PrismaClient, keywords: string[], username: string): Promise<SearchMatch[]> {
  const base: Prisma.PostWhereInput = { AND: [publicPostWhere(), username ? { author: { username } } : {}] };
  const title = await postIdsMatching(db, base, 'title', keywords);
  const description = await postIdsMatching(db, base, 'description', keywords);
  const tags = await postIdsMatching(db, base, 'tags', keywords);
  const content = await postIdsMatching(db, base, 'content', keywords);
  const ids = [...new Set([...title, ...description, ...tags, ...content])];
  const matches: SearchMatch[] = [];
  for (let offset = 0; offset < ids.length; offset += 500) {
    const rows = await db.post.findMany({
      where: { AND: [base, { id: { in: ids.slice(offset, offset + 500) } }] },
      select: { id: true, publishedAt: true },
    });
    for (const { id, publishedAt } of rows) {
      if (!publishedAt) continue;
      const titleScore = title.has(id) ? 100 : 0;
      const descriptionScore = description.has(id) ? 40 : 0;
      const tagScore = tags.has(id) ? 30 : 0;
      const contentScore = content.has(id) ? 10 : 0;
      matches.push({
        id,
        publishedAt,
        titleScore,
        descriptionScore,
        tagScore,
        contentScore,
        relevance: titleScore + descriptionScore + tagScore + contentScore,
      });
    }
  }
  return matches.sort(
    (left, right) =>
      right.relevance - left.relevance ||
      right.publishedAt.valueOf() - left.publishedAt.valueOf() ||
      right.id - left.id,
  );
}

/** Search cards keep the name of a hidden series, as they always have. */
export async function readSearchPage(
  db: PrismaClient,
  matches: SearchMatch[],
  limit: number,
  offset: number,
): Promise<Array<PostRow & SearchMatch>> {
  const page = matches.slice(offset, offset + limit);
  const rows = await db.post.findMany({
    where: { AND: [publicPostWhere(), { id: { in: page.map(({ id }) => id) } }] },
    select: postCardSelect,
  });
  const cards = new Map(rows.map((row) => [row.id, row]));
  return page.flatMap((match) => {
    const post = cards.get(match.id);
    if (!post) return [];
    return [
      {
        ...postCard(post),
        seriesUrl: post.series?.slug ?? null,
        seriesName: post.series?.name ?? null,
        likeCount: undefined,
        commentCount: undefined,
        ...match,
      },
    ];
  });
}
