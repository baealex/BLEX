import { type PrismaClient } from '@prisma/client';
import { AuthorRow, AuthorSocialLink, PublicPageViewer, SubscriptionState, databaseNow, safeExternalUrl } from '../../discovery/shared.js';

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

export async function readAuthor(db: PrismaClient, username: string): Promise<AuthorRow | null> {
  const now = databaseNow();
  const current = await db.$queryRaw<AuthorRow[]>`
    SELECT author.id AS id,
           author.username AS username,
           author.first_name AS firstName,
           author.is_active AS isActive,
           COALESCE(profile.bio, '') AS bio,
           COALESCE(profile.avatar, '') AS avatar,
           COALESCE(profile.cover, '') AS cover,
           COALESCE(profile.homepage, '') AS homepage,
           COALESCE(profile.about_html, '') AS aboutHtml,
           COALESCE(profile.about_md, '') AS aboutMarkdown,
           COALESCE(profile.role, '') AS role,
           (SELECT COUNT(*) FROM board_post AS post
             LEFT JOIN board_postconfig AS post_config ON post_config.post_id = post.id
            WHERE post.author_id = author.id
              AND post.deleted_date IS NULL AND post.published_date IS NOT NULL
              AND post.published_date <= ${now} AND COALESCE(post_config.hide, 0) = 0) AS publicPostCount,
           (SELECT COUNT(*) FROM "Series" AS series
            WHERE series.ownerId = author.id AND COALESCE(series.isHidden, 0) = 0
              AND EXISTS (SELECT 1 FROM board_post AS post
                LEFT JOIN board_postconfig AS post_config ON post_config.post_id = post.id
               WHERE post.series_id = series.id
                 AND post.deleted_date IS NULL AND post.published_date IS NOT NULL
                 AND post.published_date <= ${now} AND COALESCE(post_config.hide, 0) = 0)) AS publicSeriesCount
      FROM auth_user AS author
      LEFT JOIN board_profile AS profile ON profile.user_id = author.id
     WHERE author.username = ${username}
     LIMIT 1
  `;
  if (current[0]) return current[0];

  const previous = await db.$queryRaw<AuthorRow[]>`
    SELECT author.id AS id,
           author.username AS username,
           author.first_name AS firstName,
           author.is_active AS isActive,
           COALESCE(profile.bio, '') AS bio,
           COALESCE(profile.avatar, '') AS avatar,
           COALESCE(profile.cover, '') AS cover,
           COALESCE(profile.homepage, '') AS homepage,
           COALESCE(profile.about_html, '') AS aboutHtml,
           COALESCE(profile.about_md, '') AS aboutMarkdown,
           COALESCE(profile.role, '') AS role,
           (SELECT COUNT(*) FROM board_post AS post
             LEFT JOIN board_postconfig AS post_config ON post_config.post_id = post.id
            WHERE post.author_id = author.id
              AND post.deleted_date IS NULL AND post.published_date IS NOT NULL
              AND post.published_date <= ${now} AND COALESCE(post_config.hide, 0) = 0) AS publicPostCount,
           (SELECT COUNT(*) FROM "Series" AS series
            WHERE series.ownerId = author.id AND COALESCE(series.isHidden, 0) = 0
              AND EXISTS (SELECT 1 FROM board_post AS post
                LEFT JOIN board_postconfig AS post_config ON post_config.post_id = post.id
               WHERE post.series_id = series.id
                 AND post.deleted_date IS NULL AND post.published_date IS NOT NULL
                 AND post.published_date <= ${now} AND COALESCE(post_config.hide, 0) = 0)) AS publicSeriesCount
      FROM board_usernamechangelog AS previous
      JOIN auth_user AS author ON author.id = previous.user_id
      LEFT JOIN board_profile AS profile ON profile.user_id = author.id
     WHERE previous.username = ${username}
     ORDER BY previous.created_date DESC, previous.id DESC
     LIMIT 1
  `;
  return previous[0] ?? null;
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
