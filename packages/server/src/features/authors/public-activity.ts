import { requestLocale } from '../../platform/request-locale.js';
import { renderPage } from '../../platform/views.js';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { toIsoDateTime } from '../developer-api/index.js';
import { publicPostWhere } from '../posts/data/visibility.js';
import { sanitizePostHtml } from '../posts/post-html.js';
import { publicPostPath } from '../posts/public-post.js';
import { readableDescription } from '../posts/shared.js';
import { done, failure } from '../../platform/response.js';

interface ActivityOptions {
  currentUser: (request: FastifyRequest) => Promise<{ id: number } | null>;
  siteUrl: URL;
}

const timeZone = process.env.TZ || 'Asia/Seoul';
const dateFormat = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });

function since(date: Date) {
  const dateLabel = new Intl.DateTimeFormat(requestLocale(), { timeZone, dateStyle: 'long' });
  const relative = new Intl.RelativeTimeFormat(requestLocale(), { numeric: 'always' });
  const age = Math.max(0, (Date.now() - date.getTime()) / 60_000);
  if (!Number.isFinite(age)) return '';
  if (age > 525_600) return dateLabel.format(date);
  if (age >= 43_200) return relative.format(-Math.floor(age / 43_200), 'month');
  if (age >= 10_080) return relative.format(-Math.floor(age / 10_080), 'week');
  if (age >= 1_440) return relative.format(-Math.floor(age / 1_440), 'day');
  if (age >= 60) return relative.format(-Math.floor(age / 60), 'hour');
  return relative.format(-Math.floor(age), 'minute');
}

async function heatmap(db: PrismaClient, userId: number, own: boolean) {
  const end = new Date();
  const start = new Date(end.getTime() - 365 * 86_400_000);
  // Include both boundary days before applying the site's calendar time zone.
  const lower = new Date(start.getTime() - 2 * 86_400_000);
  const upper = new Date(end.getTime() + 2 * 86_400_000);
  const eligible: Prisma.PostWhereInput = own ? { deletedAt: null } : publicPostWhere(end);
  const [posts, comments, likes] = await Promise.all([
    db.post.findMany({
      where: { AND: [eligible, { authorId: userId, publishedAt: { gte: lower, lte: upper } }] },
      orderBy: [{ publishedAt: 'asc' }, { id: 'asc' }],
      select: { publishedAt: true },
    }),
    db.comment.findMany({
      where: { authorId: userId, deletedAt: null, createdAt: { gte: lower, lte: upper }, post: eligible },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { createdAt: true },
    }),
    db.postLike.findMany({
      where: { userId, createdAt: { gte: lower, lte: upper }, post: eligible },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }),
  ]);
  const minDay = dateFormat.format(start);
  const maxDay = dateFormat.format(end);
  const days: Record<string, number> = {};
  // Day keys keep their first-seen order in the JSON: posts, then comments, then likes.
  const entries = [
    ...posts.flatMap(({ publishedAt }) => (publishedAt ? [publishedAt] : [])),
    ...comments.map(({ createdAt }) => createdAt),
    ...likes.map(({ createdAt }) => createdAt),
  ];
  for (const date of entries) {
    const day = dateFormat.format(date);
    if (day >= minDay && day <= maxDay) days[day] = (days[day] ?? 0) + 1;
  }
  return days;
}

/** `/v1` day keys carry no separators, so they serialize as ascending integer-like keys. */
function compactDayKeys(days: Record<string, number>) {
  return Object.fromEntries(Object.entries(days).map(([day, count]) => [day.replaceAll('-', ''), count]));
}

interface RecentActivity {
  type: 'post' | 'series' | 'comment' | 'like';
  title: string;
  url: string;
  date: string;
  sortDate: number;
}

const RECENT_ACTIVITY_DAYS = 30;
const RECENT_ACTIVITY_LIMIT = 10;
async function recentActivities(db: PrismaClient, userId: number): Promise<RecentActivity[]> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - RECENT_ACTIVITY_DAYS * 86_400_000);
  const publicPost = publicPostWhere(now);
  type PostActivity = { title: string; slug: string; username: string; date: Date };
  const linkedPost = { select: { title: true, slug: true, author: { select: { username: true } } } } as const;
  const [postRows, seriesRows, commentRows, likeRows] = await Promise.all([
    db.post.findMany({
      where: { AND: [publicPost, { authorId: userId, publishedAt: { gte: cutoff } }] },
      orderBy: { publishedAt: 'desc' },
      take: 6,
      select: { title: true, slug: true, publishedAt: true, author: { select: { username: true } } },
    }),
    db.series.findMany({
      where: { ownerId: userId, isHidden: false, createdAt: { gte: cutoff, lte: now }, posts: { some: publicPost } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { name: true, slug: true, createdAt: true, owner: { select: { username: true } } },
    }),
    db.comment.findMany({
      where: { authorId: userId, deletedAt: null, createdAt: { gte: cutoff }, post: publicPost },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { createdAt: true, post: linkedPost },
    }),
    db.postLike.findMany({
      where: { userId, createdAt: { gte: cutoff }, post: publicPost },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { createdAt: true, post: linkedPost },
    }),
  ]);
  const linked = ({
    createdAt,
    post,
  }: {
    createdAt: Date;
    post: { title: string; slug: string; author: { username: string } };
  }): PostActivity => ({
    title: post.title,
    slug: post.slug,
    username: post.author.username,
    date: createdAt,
  });
  const posts = postRows.flatMap((row): PostActivity[] =>
    row.publishedAt
      ? [
          {
            title: row.title,
            slug: row.slug,
            username: row.author.username,
            date: row.publishedAt,
          },
        ]
      : [],
  );
  const series = seriesRows.map(
    (row): PostActivity => ({ title: row.name, slug: row.slug, username: row.owner.username, date: row.createdAt }),
  );
  const comments = commentRows.map(linked);
  const likes = likeRows.map(linked);
  const item = (type: RecentActivity['type'], row: PostActivity, url: string): RecentActivity => ({
    type,
    title: row.title,
    url,
    date: since(row.date),
    sortDate: row.date.getTime(),
  });
  const seriesPath = (row: PostActivity) =>
    `/@${encodeURIComponent(row.username)}/series/${encodeURIComponent(row.slug)}`;
  return [
    ...posts.map((row) => item('post', row, publicPostPath(row.username, row.slug))),
    ...series.map((row) => item('series', row, seriesPath(row))),
    ...comments.map((row) => item('comment', row, publicPostPath(row.username, row.slug))),
    ...likes.map((row) => item('like', row, publicPostPath(row.username, row.slug))),
  ]
    .sort((left, right) => right.sortDate - left.sortDate)
    .slice(0, RECENT_ACTIVITY_LIMIT);
}

export async function readAuthorActivity(db: PrismaClient, userId: number) {
  const [days, recent] = await Promise.all([heatmap(db, userId, false), recentActivities(db, userId)]);
  return { days, recent };
}

export interface RelatedPost {
  slug: string;
  title: string;
  image: string;
  description: string;
  readTime: number;
  published: Date;
  username: string;
  name: string;
  avatar: string;
}

export async function relatedPosts(db: PrismaClient, sourceId: number, sourceAuthor: number): Promise<RelatedPost[]> {
  const now = new Date();
  const sourceTags = (
    await db.tag.findMany({ where: { posts: { some: { id: sourceId } } }, select: { id: true } })
  ).map(({ id }) => id);
  if (!sourceTags.length) return [];
  // Ranks on ids, dates, and counts only, then loads the eight winners.
  const candidates = await db.post.findMany({
    where: { AND: [publicPostWhere(now), { id: { not: sourceId }, tags: { some: { id: { in: sourceTags } } } }] },
    select: {
      id: true,
      authorId: true,
      publishedAt: true,
      tags: { where: { id: { in: sourceTags } }, select: { id: true } },
      _count: { select: { tags: true, likes: true, comments: true } },
    },
  });
  const ranked = candidates
    .flatMap((post) => {
      if (!post.publishedAt) return [];
      const overlap = post.tags.length;
      const published = post.publishedAt.getTime();
      const age = (now.getTime() - published) / 86_400_000;
      return [
        {
          id: post.id,
          published,
          overlap,
          tagScore: Math.min(overlap * 3, 10),
          similarity: overlap / (sourceTags.length + post._count.tags - overlap),
          sameAuthor: post.authorId === sourceAuthor ? 1 : 0,
          quality:
            Math.min(post._count.likes * 2 + post._count.comments, 10) +
            (age < 7 ? 5 : age < 30 ? 3 : age < 90 ? 1 : 0),
        },
      ];
    })
    .sort(
      (left, right) =>
        right.tagScore - left.tagScore ||
        right.overlap - left.overlap ||
        right.similarity - left.similarity ||
        left.sameAuthor - right.sameAuthor ||
        right.quality - left.quality ||
        right.published - left.published ||
        right.id - left.id,
    )
    .slice(0, 8);
  const rows = await db.post.findMany({
    where: { AND: [publicPostWhere(now), { id: { in: ranked.map(({ id }) => id) } }] },
    select: {
      id: true,
      slug: true,
      title: true,
      image: true,
      description: true,
      readTime: true,
      publishedAt: true,
      author: { select: { username: true, name: true, profile: { select: { avatar: true } } } },
    },
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ranked.flatMap(({ id }) => {
    const post = byId.get(id);
    if (!post?.publishedAt) return [];
    return [
      {
        slug: post.slug,
        title: post.title,
        image: post.image,
        description: readableDescription(post.description),
        readTime: post.readTime,
        published: post.publishedAt,
        username: post.author.username,
        name: post.author.name,
        avatar: post.author.profile?.avatar ?? '',
      },
    ];
  });
}

export function registerPublicActivity(app: FastifyInstance, db: PrismaClient, options: ActivityOptions) {
  app.get<{ Params: { username: string } }>('/v1/users/@:username/check-redirect', async (request, reply) => {
    const changed = await db.usernameChange.findFirst({
      where: { username: request.params.username },
      orderBy: { id: 'asc' },
      select: { createdAt: true, user: { select: { username: true } } },
    });
    if (!changed) return reply.code(404).send('Not found');
    return done({
      oldUsername: request.params.username,
      newUsername: changed.user.username,
      createdDate: new Intl.DateTimeFormat(requestLocale(), { timeZone, dateStyle: 'long' }).format(changed.createdAt),
    });
  });
  app.get<{ Params: { username: string } }>('/v1/users/@:username/heatmap', async (request, reply) => {
    const account = await db.user.findUnique({ where: { username: request.params.username }, select: { id: true } });
    return account ? done(compactDayKeys(await heatmap(db, account.id, false))) : reply.code(404).send('Not found');
  });
  app.get('/v1/setting/heatmap', async (request) => {
    const user = await options.currentUser(request);
    return user ? done(compactDayKeys(await heatmap(db, user.id, true))) : failure('NL');
  });
  app.get('/v1/comments/user', async (request, reply) => {
    const user = await options.currentUser(request);
    if (!user) return failure('NL');
    const page = Number(new URL(request.url, options.siteUrl).searchParams.get('page') || '1');
    if (!Number.isSafeInteger(page) || page < 1) return reply.code(404).send('Not found');
    // A post that stopped being public keeps its title and address from its past commenters.
    const mine = {
      authorId: user.id,
      deletedAt: null,
      post: { deletedAt: null, OR: [{ authorId: user.id }, publicPostWhere()] },
    };
    const lastPage = Math.max(1, Math.ceil((await db.comment.count({ where: mine })) / 10));
    if (page > lastPage) return reply.code(404).send('Not found');
    const rows = await db.comment.findMany({
      where: mine,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * 10,
      take: 10,
      select: {
        html: true,
        createdAt: true,
        post: { select: { title: true, slug: true, author: { select: { username: true } } } },
      },
    });
    return done({
      comments: rows.map((row) => ({
        posts: { author: row.post.author.username, title: row.post.title, url: row.post.slug },
        content: sanitizePostHtml(row.html),
        createdDate: since(row.createdAt),
      })),
      lastPage,
    });
  });

  type PostRoute = { Params: { username: string; slug: string } };
  for (const route of ['/v1/users/@:username/posts/:slug/related', '/@:username/:slug/related']) {
    app.get<PostRoute>(route, async (request, reply) => {
      const { username, slug } = request.params;
      const viewer = await options.currentUser(request);
      const source = await db.post.findFirst({
        where: { slug, deletedAt: null, author: { username }, OR: [{ authorId: viewer?.id ?? -1 }, publicPostWhere()] },
        select: { id: true, title: true, authorId: true },
      });
      if (!source) return reply.code(404).send('Not found');
      const items = await relatedPosts(db, source.id, source.authorId);
      reply.header('Cache-Control', 'private, no-store');
      if (route.startsWith('/v1/'))
        return done({
          posts: items.map((item) => ({
            url: item.slug,
            title: item.title,
            image: item.image || null,
            metaDescription: item.description,
            readTime: item.readTime,
            publishedDate: since(item.published),
            publishedDateIso: dateFormat.format(item.published),
            publishedAt: toIsoDateTime(item.published),
            authorUsername: item.username,
            authorName: item.name,
            authorImage: item.avatar || null,
          })),
        });
      return reply
        .type('text/html; charset=utf-8')
        .send(renderPage('@{$username}/{$slug}/related', { source, username, slug, items }));
    });
  }
}
