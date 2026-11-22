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
    id: true, username: true, first_name: true, is_active: true,
    board_profile: { select: { bio: true, avatar: true, cover: true, homepage: true, about_html: true, about_md: true, role: true } },
    _count: { select: {
      posts: { where: publicPost },
      series: { where: { isHidden: false, posts: { some: publicPost } } },
    } },
  } satisfies Prisma.UserSelect;
}

function authorRow(user: Prisma.UserGetPayload<{ select: ReturnType<typeof authorSelect> }>): AuthorRow {
  const profile = user.board_profile;
  return {
    id: user.id, username: user.username, firstName: user.first_name, isActive: user.is_active,
    bio: profile?.bio ?? '', avatar: profile?.avatar ?? '', cover: profile?.cover ?? '', homepage: profile?.homepage ?? '',
    aboutHtml: profile?.about_html ?? '', aboutMarkdown: profile?.about_md ?? '', role: profile?.role ?? '',
    publicPostCount: user._count.posts, publicSeriesCount: user._count.series,
  };
}

export async function readAuthor(db: PrismaClient, username: string): Promise<AuthorRow | null> {
  const current = await db.user.findUnique({ where: { username }, select: authorSelect() });
  if (current) return authorRow(current);
  const previous = await db.usernameChange.findFirst({
    where: { username },
    orderBy: [{ created_date: 'desc' }, { id: 'desc' }],
    select: { user: { select: authorSelect() } },
  });
  return previous ? authorRow(previous.user) : null;
}

export async function readAuthorSocialLinks(db: PrismaClient, authorId: number): Promise<AuthorSocialLink[]> {
  const rows = await db.$queryRaw<Array<AuthorSocialLink>>`
    SELECT id, name, value FROM board_userlinkmeta
     WHERE user_id = ${authorId}
     ORDER BY "order" ASC, id ASC
  `;
  return rows.flatMap((link) => {
    const value = safeExternalUrl(link.value);
    return value ? [{ ...link, value }] : [];
  });
}

export function isEditor(author: AuthorRow): boolean {
  return Number(author.isActive) !== 0 && author.role === 'EDITOR';
}

export function authorPath(username: string, suffix = ''): string {
  return `/@${encodeURIComponent(username)}${suffix}`;
}
