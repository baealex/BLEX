import type { PrismaClient } from '@prisma/client';
import { sanitizePostHtml } from './post-html.js';
import { readPublicSiteBrand, type SiteBrand } from './public-pages/index.js';

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
  visibility: 'public' | 'hidden' | 'scheduled';
}

interface PostBanner {
  id: number;
  position: string;
  contentHtml: string;
}

export interface PostPresentation extends SiteBrand {
  aeoEnabled: boolean;
  seriesName: string | null;
  seriesUrl: string | null;
  seriesAuthor: string | null;
  tags: string[];
  banners: PostBanner[];
}

export function publicPostPath(username: string, slug: string): string {
  return `/@${encodeURIComponent(username)}/${encodeURIComponent(slug)}`;
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

  // Django stores UTC timestamps as text with a space and optional fractional seconds.
  const now = new Date().toISOString().replace('T', ' ').replace('Z', '');
  const [post] = await db.$queryRaw<PublicPost[]>`
    SELECT post.id, author.id AS authorId, author.username, post.url AS slug, post.title, post.subtitle, post.image,
           post.read_time AS readTime, COALESCE(profile.avatar, '') AS authorAvatar,
           COALESCE(config.cover_layout, 'default') AS coverLayout,
           COALESCE(config.cover_image_ratio, 'auto') AS coverImageRatio,
           COALESCE(config.cover_image_position, 'right') AS coverImagePosition,
           CAST(post.published_date AS TEXT) AS publishedDate, CAST(post.updated_date AS TEXT) AS updatedDate,
           CASE WHEN COALESCE(config.hide, 0) <> 0 THEN 'hidden'
                WHEN post.published_date > ${now} THEN 'scheduled' ELSE 'public' END AS visibility,
           post.meta_description AS description, COALESCE(content.content_html, '') AS contentHtml
      FROM board_post AS post
      JOIN auth_user AS author ON author.id = post.author_id
      LEFT JOIN board_profile AS profile ON profile.user_id = author.id
      LEFT JOIN board_postconfig AS config ON config.post_id = post.id
      LEFT JOIN board_postcontent AS content ON content.post_id = post.id
     WHERE post.url = ${slug}
       AND post.deleted_date IS NULL
       AND post.published_date IS NOT NULL
       AND (
         (${viewerId ?? null} = author.id AND author.username = ${username})
         OR (
           COALESCE(config.hide, 0) = 0 AND post.published_date <= ${now}
           AND (author.username = ${username} OR (config.hide = 0 AND EXISTS (
             SELECT 1 FROM board_usernamechangelog AS previous
              WHERE previous.user_id = author.id AND previous.username = ${username}
           )))
         )
       )
     LIMIT 1
  `;

  return post ? { ...post, contentHtml: sanitizePostHtml(post.contentHtml) } : null;
}

export async function readPostPresentation(db: PrismaClient, post: Pick<PublicPost, 'id' | 'authorId'>): Promise<PostPresentation> {
  const [brand, [metadata], tags, banners] = await Promise.all([
    readPublicSiteBrand(db),
    db.$queryRaw<Array<{ aeoEnabled: number; seriesName: string | null; seriesUrl: string | null; seriesAuthor: string | null }>>`
      SELECT CAST(COALESCE(site.aeo_enabled, 0) AS INTEGER) AS aeoEnabled,
             series.name AS seriesName, series.url AS seriesUrl, author.username AS seriesAuthor
        FROM board_post AS post
        LEFT JOIN board_sitesetting AS site ON site.id = 1
        LEFT JOIN board_series AS series ON series.id = post.series_id AND series.hide = 0
        LEFT JOIN auth_user AS author ON author.id = series.owner_id
       WHERE post.id = ${post.id}
    `,
    db.$queryRaw<Array<{ value: string }>>`
      SELECT tag.value FROM board_post_tags AS attached JOIN board_tag AS tag ON tag.id = attached.tag_id
       WHERE attached.post_id = ${post.id} ORDER BY tag.id
    `,
    db.$queryRaw<PostBanner[]>`
      SELECT id, position, content_html AS contentHtml FROM board_sitebanner
       WHERE is_active = 1 AND position IN ('top', 'bottom', 'left', 'right')
         AND (scope = 'global' OR (scope = 'user' AND user_id = ${post.authorId}))
       ORDER BY "order", created_date DESC, id DESC
    `,
  ]);
  return {
    ...brand,
    aeoEnabled: Boolean(metadata?.aeoEnabled),
    seriesName: metadata?.seriesName ?? null,
    seriesUrl: metadata?.seriesUrl ?? null,
    seriesAuthor: metadata?.seriesAuthor ?? null,
    tags: tags.map(({ value }) => value),
    banners: banners.map((banner) => ({ ...banner, contentHtml: sanitizePostHtml(banner.contentHtml) })).filter((banner) => banner.contentHtml),
  };
}
