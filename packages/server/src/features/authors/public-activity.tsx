import { SiteIcon, type SiteIconName } from '../../appearance/icons.js';
import { renderApplicationDocument } from '../../application/document.js';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { toIsoDateTime } from '../developer-api/index.js';
import { storedDateText } from '../../compat/django-format.js';
import { publicPostWhere } from '../posts/data/visibility.js';
import { sanitizePostHtml } from '../posts/post-html.js';
import { publicPostPath } from '../posts/public-post.js';
import { done, failure } from '../../platform/response.js';

interface ActivityOptions {
  currentUser: (request: FastifyRequest) => Promise<{ id: number } | null>;
  siteUrl: URL;
}

const timeZone = process.env.TZ || 'Asia/Seoul';
const dateFormat = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
const dateLabel = new Intl.DateTimeFormat('ko-KR', { timeZone, dateStyle: 'long' });
const relative = new Intl.RelativeTimeFormat('ko', { numeric: 'always' });

function storedDate(value: string | number | bigint | Date) {
  return typeof value === 'string' ? new Date(toIsoDateTime(value) ?? '') : new Date(value instanceof Date ? value : Number(value));
}
function since(value: string | number | bigint | Date) {
  const date = storedDate(value);
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
      where: { authorId: userId, createdAt: { gte: lower, lte: upper }, post: eligible },
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
  const entries = [...posts.map(({ publishedAt }) => publishedAt!), ...comments.map(({ createdAt }) => createdAt), ...likes.map(({ createdAt }) => createdAt)];
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
const activityLabels: Record<RecentActivity['type'], { label: string; icon: SiteIconName }> = {
  post: { label: '새 포스트를 작성했어요', icon: 'writing' },
  series: { label: '시리즈를 만들었어요', icon: 'stack-2' },
  comment: { label: '댓글을 남겼어요', icon: 'message' },
  like: { label: '좋아요를 눌렀어요', icon: 'heart' },
};

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
      where: { authorId: userId, createdAt: { gte: cutoff }, post: publicPost },
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
  const linked = ({ createdAt, post }: { createdAt: Date; post: { title: string; slug: string; author: { username: string } } }): PostActivity => ({
    title: post.title, slug: post.slug, username: post.author.username, date: createdAt,
  });
  const posts = postRows.map((row): PostActivity => ({ title: row.title, slug: row.slug, username: row.author.username, date: row.publishedAt! }));
  const series = seriesRows.map((row): PostActivity => ({ title: row.name, slug: row.slug, username: row.owner.username, date: row.createdAt }));
  const comments = commentRows.map(linked);
  const likes = likeRows.map(linked);
  const item = (type: RecentActivity['type'], row: PostActivity, url: string): RecentActivity => ({
    type, title: row.title, url, date: since(row.date), sortDate: storedDate(row.date).getTime(),
  });
  const seriesPath = (row: PostActivity) => `/@${encodeURIComponent(row.username)}/series/${encodeURIComponent(row.slug)}`;
  return [
    ...posts.map((row) => item('post', row, publicPostPath(row.username, row.slug))),
    ...series.map((row) => item('series', row, seriesPath(row))),
    ...comments.map((row) => item('comment', row, publicPostPath(row.username, row.slug))),
    ...likes.map((row) => item('like', row, publicPostPath(row.username, row.slug))),
  ].sort((left, right) => right.sortDate - left.sortDate).slice(0, RECENT_ACTIVITY_LIMIT);
}

export async function readAuthorActivity(db: PrismaClient, userId: number) {
  const [days, recent] = await Promise.all([heatmap(db, userId, false), recentActivities(db, userId)]);
  return { days, recent };
}

function ActivityHeatmap({ days }: { days: Record<string, number> }) {
  const total = Object.values(days).reduce((sum, count) => sum + count, 0);
  return <div className="overflow-x-auto">
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        <p className="text-xs font-medium text-content-secondary">지난 1년 활동</p>
        <p className="text-lg font-semibold tabular-nums text-content">{total}회</p>
      </div>
      <p className="text-xs text-content-hint">단위: 활동</p>
    </div>
    <div className="author-heatmap-chart mx-auto min-h-[150px] w-fit" data-heatmap-days={JSON.stringify(days)} />
  </div>;
}

export function AuthorActivitySection({ days, recent }: Awaited<ReturnType<typeof readAuthorActivity>>) {
  return <section>
    <h2 className="mb-4 text-2xl font-bold tracking-tight text-content">연간 활동</h2>
    <div className="mb-6 rounded-2xl bg-surface p-6 ring-1 ring-line/60 md:p-7">
      <ActivityHeatmap days={days} />
      {recent.length > 0 ? <div className="mt-8 border-t border-line-light pt-6">
        <div className="mb-3 flex items-center justify-between px-1">
          <h3 className="text-sm font-semibold text-content">활동 내역</h3>
          <span className="rounded-md bg-surface-subtle px-2 py-0.5 text-[11px] font-medium text-content-secondary">{recent.length}개</span>
        </div>
        <div className="space-y-3">
          {recent.map((activity) => <a key={`${activity.type}:${activity.url}:${activity.sortDate}`} href={activity.url}
            className="flex items-center gap-4 rounded-xl bg-surface px-3 py-3 ring-1 ring-line/60 hover:ring-line-strong">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-subtle text-content-secondary">
              <SiteIcon name={activityLabels[activity.type].icon} className="text-sm" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="mb-1 flex items-center justify-between gap-2 text-xs text-content-secondary">
                <span>{activityLabels[activity.type].label}</span><span>{activity.date}</span>
              </span>
              <span className="line-clamp-1 text-sm font-semibold text-content-secondary">{activity.title}</span>
            </span>
          </a>)}
        </div>
      </div> : <p className="mt-6 text-center text-sm text-content-secondary">표시할 활동이 없습니다</p>}
    </div>
  </section>;
}

export interface RelatedPost { slug: string; title: string; image: string; description: string; readTime: number; published: string; username: string; name: string; avatar: string }

export async function relatedPosts(db: PrismaClient, sourceId: number, sourceAuthor: number): Promise<RelatedPost[]> {
  const now = new Date();
  const sourceTags = (await db.tag.findMany({ where: { posts: { some: { id: sourceId } } }, select: { id: true } })).map(({ id }) => id);
  if (!sourceTags.length) return [];
  // Ranks on ids, dates, and counts only, then loads the eight winners.
  const candidates = await db.post.findMany({
    where: { AND: [publicPostWhere(now), { id: { not: sourceId }, tags: { some: { id: { in: sourceTags } } } }] },
    select: {
      id: true, authorId: true, publishedAt: true,
      tags: { where: { id: { in: sourceTags } }, select: { id: true } },
      _count: { select: { tags: true, likes: true, comments: true } },
    },
  });
  const ranked = candidates.map((post) => {
    const overlap = post.tags.length;
    const age = (now.getTime() - post.publishedAt!.getTime()) / 86_400_000;
    return {
      id: post.id,
      published: post.publishedAt!.getTime(),
      overlap,
      tagScore: Math.min(overlap * 3, 10),
      similarity: overlap / (sourceTags.length + post._count.tags - overlap),
      sameAuthor: post.authorId === sourceAuthor ? 1 : 0,
      quality: Math.min(post._count.likes * 2 + post._count.comments, 10) + (age < 7 ? 5 : age < 30 ? 3 : age < 90 ? 1 : 0),
    };
  }).sort((left, right) => right.tagScore - left.tagScore || right.overlap - left.overlap || right.similarity - left.similarity
    || left.sameAuthor - right.sameAuthor || right.quality - left.quality || right.published - left.published || right.id - left.id).slice(0, 8);
  const rows = await db.post.findMany({
    where: { id: { in: ranked.map(({ id }) => id) } },
    select: {
      id: true, slug: true, title: true, image: true, description: true, readTime: true, publishedAt: true,
      author: { select: { username: true, name: true, profile: { select: { avatar: true } } } },
    },
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ranked.map(({ id }) => {
    const post = byId.get(id)!;
    return {
      slug: post.slug, title: post.title, image: post.image, description: post.description, readTime: post.readTime,
      published: storedDateText(post.publishedAt!), username: post.author.username, name: post.author.name,
      avatar: post.author.profile?.avatar ?? '',
    };
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
    return done({ oldUsername: request.params.username, newUsername: changed.user.username, createdDate: dateLabel.format(changed.createdAt) });
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
    const mine = { authorId: user.id, post: { deletedAt: null } };
    const lastPage = Math.max(1, Math.ceil(await db.comment.count({ where: mine }) / 10));
    if (page > lastPage) return reply.code(404).send('Not found');
    const rows = await db.comment.findMany({
      where: mine,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * 10,
      take: 10,
      select: { html: true, createdAt: true, post: { select: { title: true, slug: true, author: { select: { username: true } } } } },
    });
    return done({ comments: rows.map((row) => ({ posts: { author: row.post.author.username, title: row.post.title, url: row.post.slug },
      content: sanitizePostHtml(row.html), createdDate: since(row.createdAt) })), lastPage });
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
      if (route.startsWith('/v1/')) return done({ posts: items.map((item) => ({
        url: item.slug, title: item.title, image: item.image || null, metaDescription: item.description, readTime: item.readTime,
        publishedDate: since(item.published), publishedDateIso: dateFormat.format(storedDate(item.published)), publishedAt: toIsoDateTime(item.published),
        authorUsername: item.username, authorName: item.name, authorImage: item.avatar || null,
      })) });
      return reply.type('text/html; charset=utf-8').send(renderApplicationDocument(<html lang="ko"><head><meta charSet="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="robots" content="noindex,follow" /><title>관련 글 · {source.title}</title>
          <style>{'body{margin:3rem auto;max-width:44rem;padding:0 1rem;font:1rem/1.65 system-ui}li{margin:1rem 0}'}</style>
        </head><body><main><a href={publicPostPath(username, slug)}>글로 돌아가기</a><h1>관련 글</h1>
          {items.length ? <ul>{items.map((item) => <li key={item.slug}>
            <a href={publicPostPath(item.username, item.slug)}>{item.title}</a><p>{item.description}</p>
          </li>)}</ul> : <p>공통 태그가 붙은 글이 없습니다.</p>}
        </main></body></html>));
    });
  }
}
