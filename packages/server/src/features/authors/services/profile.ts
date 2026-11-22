import type { Prisma, PrismaClient } from '@prisma/client';
import { AuthorRow, AuthorSocialLink, PublicPageViewer, SubscriptionState, safeExternalUrl } from '../../discovery/shared.js';
import { publicPostWhere } from '../../posts/data/visibility.js';

export async function subscriptionState(
  db: PrismaClient,
  author: AuthorRow,
  viewer: PublicPageViewer | null,
): Promise<SubscriptionState> {
  const canSubscribe = isEditor(author) && viewer?.id !== author.id;
  if (!canSubscribe || !viewer) return { canSubscribe, isSubscribed: false };
  const subscription = await db.authorSubscription.findUnique({
    where: { subscriberId_authorId: { subscriberId: viewer.id, authorId: author.id } },
    select: { id: true },
  });
  return { canSubscribe: true, isSubscribed: subscription !== null };
}

function authorSelect() {
  const publicPost = publicPostWhere();
  return {
    id: true, username: true, name: true, isActive: true,
    profile: { select: { bio: true, avatar: true, cover: true, homepage: true, aboutHtml: true, aboutMarkdown: true, role: true } },
    _count: { select: {
      posts: { where: publicPost },
      series: { where: { isHidden: false, posts: { some: publicPost } } },
    } },
  } satisfies Prisma.UserSelect;
}

function authorRow(user: Prisma.UserGetPayload<{ select: ReturnType<typeof authorSelect> }>): AuthorRow {
  const { profile } = user;
  return {
    id: user.id, username: user.username, firstName: user.name, isActive: user.isActive,
    bio: profile?.bio ?? '', avatar: profile?.avatar ?? '', cover: profile?.cover ?? '', homepage: profile?.homepage ?? '',
    aboutHtml: profile?.aboutHtml ?? '', aboutMarkdown: profile?.aboutMarkdown ?? '', role: profile?.role ?? '',
    publicPostCount: user._count.posts, publicSeriesCount: user._count.series,
  };
}

export async function readAuthor(db: PrismaClient, username: string): Promise<AuthorRow | null> {
  const current = await db.user.findUnique({ where: { username }, select: authorSelect() });
  if (current) return authorRow(current);
  const previous = await db.usernameChange.findFirst({
    where: { username },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { user: { select: authorSelect() } },
  });
  return previous ? authorRow(previous.user) : null;
}

export async function readAuthorSocialLinks(db: PrismaClient, authorId: number): Promise<AuthorSocialLink[]> {
  const rows = await db.socialLink.findMany({
    where: { userId: authorId },
    orderBy: [{ order: 'asc' }, { id: 'asc' }],
    select: { id: true, platform: true, url: true },
  });
  return rows.flatMap((link) => {
    const value = safeExternalUrl(link.url);
    return value ? [{ id: link.id, name: link.platform, value }] : [];
  });
}

export function isEditor(author: AuthorRow): boolean {
  return author.isActive && author.role === 'EDITOR';
}

export function authorPath(username: string, suffix = ''): string {
  return `/@${encodeURIComponent(username)}${suffix}`;
}
