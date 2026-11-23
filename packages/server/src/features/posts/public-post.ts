import type { Prisma, PrismaClient } from '@prisma/client';
import { storedDateText } from '../../platform/date-format.js';
import { publicPostWhere } from './data/visibility.js';
import { sanitizePostHtml } from './post-html.js';
import { readPublicSiteBrand, type SiteBrand } from '../discovery/http/pages.js';

export interface PublicPost {
  id: number;
  authorId: number;
  username: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  contentHtml: string;
  image: string;
  readTime: number;
  authorAvatar: string;
  coverLayout: string;
  coverImagePosition: string;
  coverImageRatio: string;
  publishedDate: string;
  updatedDate: string;
  visibility: 'public' | 'hidden' | 'moderated' | 'scheduled' | 'draft';
}

export interface DraftPreview extends PublicPost {
  authorBio: string;
  authorHomepage: string;
  isStaff: boolean;
  unreadCount: number;
}

interface PostBanner {
  id: number;
  position: string;
  contentHtml: string;
}

export interface PostSeriesEntry {
  url: string;
  title: string;
  index: number;
}

export interface PostSeriesNavigation {
  index: number;
  total: number;
  entries: PostSeriesEntry[];
  previous: PostSeriesEntry | null;
  next: PostSeriesEntry | null;
}

const SERIES_WINDOW = 5;

/** Returns null when the current post is not part of the public series list. */
export function seriesNavigation(
  posts: Array<{ id: number; url: string; title: string }>,
  postId: number,
): PostSeriesNavigation | null {
  const current = posts.findIndex((post) => post.id === postId);
  if (current < 0) return null;
  const entries = posts.map(({ url, title }, position) => ({ url, title, index: position + 1 }));
  const lastStart = Math.max(0, entries.length - SERIES_WINDOW);
  const start = Math.min(Math.max(0, current - 2), lastStart);
  return {
    index: current + 1,
    total: entries.length,
    entries: entries.slice(start, start + SERIES_WINDOW),
    previous: entries[current - 1] ?? null,
    next: entries[current + 1] ?? null,
  };
}

export interface PostPresentation extends SiteBrand {
  aeoEnabled: boolean;
  seriesName: string | null;
  seriesUrl: string | null;
  seriesAuthor: string | null;
  seriesNavigation?: PostSeriesNavigation | null;
  tags: string[];
  banners: PostBanner[];
}

export function publicPostPath(username: string, slug: string): string {
  return `/@${encodeURIComponent(username)}/${encodeURIComponent(slug)}`;
}

const publicPostSelect = {
  id: true,
  authorId: true,
  slug: true,
  title: true,
  subtitle: true,
  image: true,
  readTime: true,
  description: true,
  coverLayout: true,
  coverImageRatio: true,
  coverImagePosition: true,
  publishedAt: true,
  updatedAt: true,
  createdAt: true,
  isHidden: true,
  moderation: true,
  content: { select: { html: true } },
} satisfies Prisma.PostSelect;

type SelectedPublicPost = Prisma.PostGetPayload<{ select: typeof publicPostSelect }>;

function publicPostFields(post: SelectedPublicPost, username: string, avatar: string | null | undefined) {
  return {
    id: post.id,
    authorId: post.authorId,
    username,
    slug: post.slug,
    title: post.title,
    subtitle: post.subtitle,
    image: post.image,
    readTime: post.readTime,
    authorAvatar: avatar ?? '',
    coverLayout: post.coverLayout,
    coverImageRatio: post.coverImageRatio,
    coverImagePosition: post.coverImagePosition,
    description: post.description,
    contentHtml: sanitizePostHtml(post.content?.html ?? ''),
  };
}

export async function readPublicPost(
  db: PrismaClient,
  username: string,
  slug: string,
  viewerId?: number,
): Promise<PublicPost | null> {
  if (!username || !slug) {
    return null;
  }

  const now = new Date();
  const post = await db.post.findFirst({
    where: {
      slug,
      deletedAt: null,
      publishedAt: { not: null },
      OR: [
        ...(viewerId === undefined ? [] : [{ authorId: viewerId, author: { username } }]),
        {
          ...publicPostWhere(now),
          OR: [{ author: { username } }, { author: { usernameChanges: { some: { username } } } }],
        },
      ],
    },
    select: { ...publicPostSelect, author: { select: { username: true, profile: { select: { avatar: true } } } } },
  });
  if (!post) return null;
  return {
    ...publicPostFields(post, post.author.username, post.author.profile?.avatar),
    publishedDate: storedDateText(post.publishedAt!),
    updatedDate: storedDateText(post.updatedAt),
    visibility: post.moderation
      ? 'moderated'
      : post.isHidden
        ? 'hidden'
        : post.publishedAt! > now
          ? 'scheduled'
          : 'public',
  };
}

/** An author's own unpublished post, dated the way the 3.x preview screen dates it. */
export async function readDraftPreview(db: PrismaClient, authorId: number, slug: string): Promise<DraftPreview | null> {
  const post = await db.post.findFirst({
    where: { slug, authorId, publishedAt: null, deletedAt: null },
    select: {
      ...publicPostSelect,
      author: {
        select: { username: true, isStaff: true, profile: { select: { avatar: true, bio: true, homepage: true } } },
      },
    },
  });
  if (!post) return null;
  const unreadCount = await db.notification.count({ where: { userId: authorId, isRead: false } });
  const profile = post.author.profile;
  const previewDate = storedDateText(post.updatedAt);
  return {
    ...publicPostFields(post, post.author.username, profile?.avatar),
    publishedDate: previewDate,
    updatedDate: previewDate,
    visibility: 'draft',
    authorBio: profile?.bio ?? '',
    authorHomepage: profile?.homepage ?? '',
    isStaff: post.author.isStaff,
    unreadCount,
  };
}

export async function readPostPresentation(
  db: PrismaClient,
  post: Pick<PublicPost, 'id' | 'authorId'>,
): Promise<PostPresentation> {
  const [brand, site, placement, tags, banners] = await Promise.all([
    readPublicSiteBrand(db),
    db.siteSetting.findUnique({ where: { id: 1 }, select: { aeoEnabled: true } }),
    db.post.findUnique({
      where: { id: post.id },
      select: {
        series: { select: { id: true, name: true, slug: true, isHidden: true, owner: { select: { username: true } } } },
      },
    }),
    db.tag.findMany({ where: { posts: { some: { id: post.id } } }, orderBy: { id: 'asc' }, select: { name: true } }),
    db.siteBanner.findMany({
      where: { isActive: true, OR: [{ scope: 'global' }, { scope: 'user', userId: post.authorId }] },
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true, position: true, contentHtml: true },
    }),
  ]);
  const series = placement?.series && !placement.series.isHidden ? placement.series : null;
  const seriesPosts = !series
    ? []
    : await db.post.findMany({
        where: { seriesId: series.id, ...publicPostWhere() },
        orderBy: [{ publishedAt: 'asc' }, { id: 'asc' }],
        select: { id: true, slug: true, title: true },
      });
  return {
    ...brand,
    aeoEnabled: site?.aeoEnabled ?? false,
    seriesNavigation: seriesNavigation(
      seriesPosts.map(({ id, slug, title }) => ({ id, url: slug, title })),
      post.id,
    ),
    seriesName: series?.name ?? null,
    seriesUrl: series?.slug ?? null,
    seriesAuthor: series?.owner.username ?? null,
    tags: tags.map(({ name }) => name),
    banners: banners
      .map((banner) => ({ ...banner, contentHtml: sanitizePostHtml(banner.contentHtml) }))
      .filter((banner) => banner.contentHtml),
  };
}
