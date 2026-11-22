import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { htmlToMarkdown } from './markdown.js';
import { publicPostWhere } from '../../posts/data/visibility.js';
import { sanitizePostHtml } from '../../posts/post-html.js';

const sitemapSections = ['site', 'user', 'posts', 'series', 'staticpages'] as const;
const sitemapLimit = 50_000;
const sitemapNamespace = 'http://www.sitemaps.org/schemas/sitemap/0.9';
const defaultRobotsRules = [
  'Disallow: /*.preview.jpg',
  'Disallow: /*.minify.*',
  'Disallow: /settings/',
  'Disallow: /admin-settings/',
  'Disallow: /write',
  'Disallow: /v1/',
];

type DbDate = Date | null;

type SiteSetting = {
  seoEnabled: boolean;
  aeoEnabled: boolean;
  robotsTxtExtraRules: string;
  siteName: string;
};

type PublicPostRow = {
  id: number;
  username: string;
  title: string;
  subtitle: string;
  slug: string;
  publishedDate: DbDate;
  updatedDate: DbDate;
  contentHtml: string;
};

type SeriesRow = {
  id: number;
  username: string;
  name: string;
  slug: string;
  textMd: string;
  textHtml: string;
  updatedDate: DbDate;
};

type UserRow = { id: number; username: string; firstName: string };

type FeedPostRow = {
  username: string;
  title: string;
  slug: string;
  publishedDate: DbDate;
  contentHtml: string;
};

type SitemapMetadata = { itemCount: number; latestLastmod: DbDate };
type SitemapUrl = { location: string; lastmod?: DbDate; changefreq: string; priority: string };

async function rssOrigin(db: PrismaClient, siteUrl: URL): Promise<URL> {
  const site = await db.siteSetting.findUnique({ where: { id: 1 }, select: { domain: true } });
  const origin = site?.domain ? URL.parse(`${siteUrl.protocol}//${site.domain}`) : null;
  return origin && origin.host && origin.pathname === '/' && !origin.username && !origin.password &&
    !origin.search && !origin.hash ? origin : siteUrl;
}

export async function searchIndexingEnabled(db: PrismaClient): Promise<boolean> {
  const setting = await db.siteSetting.findUnique({ where: { id: 1 }, select: { seoEnabled: true } });
  return setting?.seoEnabled ?? true;
}

export function registerPublicDiscovery(app: FastifyInstance, db: PrismaClient, siteUrl: URL): void {
  app.get('/llms.txt', async (_request, reply) => {
    const setting = await readSiteSetting(db);
    if (!setting.aeoEnabled) return notFound(reply);
    const content = buildLlmsTxt(siteUrl, setting);
    return reply.type('text/plain; charset=utf-8')
      .header('X-Estimated-Tokens', String(estimateTokens(content)))
      .send(content);
  });

  app.get('/robots.txt', async (_request, reply) => {
    const setting = await readSiteSetting(db);
    const lines = ['User-agent: *', ...defaultRobotsRules];
    if (setting.aeoEnabled) {
      lines.push('', `# AI agent entry point: ${absoluteUrl(siteUrl, '/llms.txt')}`);
    } else {
      lines.push('Disallow: /llms.txt', 'Disallow: /*.md');
    }
    if (setting.seoEnabled) {
      lines.push(`Sitemap: ${absoluteUrl(siteUrl, '/sitemap.xml')}`);
    } else {
      lines.push('', '# Search indexing is disabled at runtime.', '# Page responses include X-Robots-Tag and HTML robots meta noindex signals.');
    }
    const extraRules = (setting.robotsTxtExtraRules ?? '').split(/\r?\n/).filter((line) => line.trim()).map((line) => line.replace(/\s+$/g, ''));
    if (extraRules.length) lines.push('', '# Custom rules', ...extraRules);
    return reply.type('text/plain; charset=utf-8').send(`${lines.join('\n').trim()}\n`);
  });

  app.get('/sitemap.xml', async (_request, reply) => {
    const metadata = await readAllSitemapMetadata(db);
    const entries: Array<{ location: string; lastmod: DbDate }> = [];
    let allIndexesHaveLastmod = true;
    let latestLastmod: DbDate = null;
    for (const section of sitemapSections) {
      const sectionMetadata = metadata[section];
      if (!sectionMetadata.latestLastmod) allIndexesHaveLastmod = false;
      else latestLastmod = latestDate(latestLastmod, sectionMetadata.latestLastmod);
      const pageCount = Math.max(1, Math.ceil(sectionMetadata.itemCount / sitemapLimit));
      const sectionPath = `/${section}/sitemap.xml`;
      entries.push({ location: absoluteUrl(siteUrl, sectionPath), lastmod: sectionMetadata.latestLastmod });
      for (let page = 2; page <= pageCount; page += 1) {
        entries.push({ location: absoluteUrl(siteUrl, `${sectionPath}?p=${page}`), lastmod: sectionMetadata.latestLastmod });
      }
    }
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="${sitemapNamespace}">${entries.map((entry) =>
      `<sitemap><loc>${xmlEscape(entry.location)}</loc>${entry.lastmod ? `<lastmod>${xmlEscape(formatIsoDate(entry.lastmod))}</lastmod>` : ''}</sitemap>`,
    ).join('')}</sitemapindex>`;
    const response = reply.type('application/xml; charset=utf-8').header('X-Robots-Tag', 'noindex, nofollow');
    if (allIndexesHaveLastmod && latestLastmod) response.header('Last-Modified', latestLastmod.toUTCString());
    return response.send(xml);
  });

  app.get<{ Params: { section: string }; Querystring: { p?: string } }>('/:section/sitemap.xml', async (request, reply) => {
    const section = request.params.section;
    if (!sitemapSections.includes(section as (typeof sitemapSections)[number])) return notFound(reply);
    const metadata = await readSitemapMetadata(db, section as (typeof sitemapSections)[number]);
    const page = parsePage(request.query.p);
    const pageCount = Math.max(1, Math.ceil(metadata.itemCount / sitemapLimit));
    if (!page || page > pageCount) return notFound(reply);
    const urls = await readSitemapPage(db, siteUrl, section as (typeof sitemapSections)[number], page);
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="${sitemapNamespace}">${urls.map((item) =>
      `<url><loc>${xmlEscape(item.location)}</loc>${item.lastmod ? `<lastmod>${xmlEscape(formatIsoDate(item.lastmod))}</lastmod>` : ''}<changefreq>${item.changefreq}</changefreq><priority>${item.priority}</priority></url>`,
    ).join('')}</urlset>`;
    const response = reply.type('application/xml; charset=utf-8').header('X-Robots-Tag', 'noindex, nofollow');
    if (metadata.latestLastmod) response.header('Last-Modified', metadata.latestLastmod.toUTCString());
    return response.send(xml);
  });

  app.get('/rss', async (_request, reply) => {
    const setting = await readSiteSetting(db);
    const posts = await readFeedPosts(db, null);
    const origin = await rssOrigin(db, siteUrl);
    return reply.type('application/xml; charset=utf-8').send(buildRss(origin, posts, {
      title: siteName(setting),
      link: absoluteUrl(origin, '/'),
      description: siteDescription(setting),
    }));
  });

  app.get<{ Params: { username: string } }>('/rss/@:username', async (request, reply) => {
    const username = request.params.username;
    const user = await findUser(db, username);
    if (!user) {
      const renamedUsername = await findRenamedUsername(db, username);
      if (renamedUsername) return redirect(reply, request, `/rss/@${encodeURIComponent(renamedUsername)}`);
      return notFound(reply);
    }
    const profile = await db.profile.findUnique({ where: { userId: user.id }, select: { bio: true, avatar: true } });
    const posts = await readFeedPosts(db, user.id);
    const origin = await rssOrigin(db, siteUrl);
    const imagePath = profile?.avatar
      ? `/resources/media/${profile.avatar.replace(/^\/+/, '')}`
      : '/resources/assets/images/default-avatar.jpg';
    return reply.type('application/xml; charset=utf-8').send(buildRss(origin, posts, {
      title: `${user.username} (${user.firstName})`,
      link: absoluteUrl(origin, `/@${encodeURIComponent(user.username)}`),
      description: profile?.bio || `${user.username}'s rss`,
      image: { url: absoluteUrl(origin, imagePath), title: `${user.username} (${user.firstName})`, link: absoluteUrl(origin, `/@${encodeURIComponent(user.username)}`) },
    }));
  });

  app.get<{ Params: { username: string; postUrl: string } }>('/@:username/:postUrl.md', async (request, reply) => {
    const setting = await readSiteSetting(db);
    if (!setting.aeoEnabled) return notFound(reply);
    const post = await readPublicPost(db, request.params.username, request.params.postUrl);
    if (!post) return notFound(reply);
    if (post.username !== request.params.username) {
      return redirect(reply, request, `/@${encodeURIComponent(post.username)}/${encodeURIComponent(post.slug)}.md`);
    }
    const tags = await readPostTags(db, post.id);
    const sourceUrl = absoluteUrl(siteUrl, `/@${encodeURIComponent(post.username)}/${encodeURIComponent(post.slug)}`);
    const lines = [
      `# ${post.title}`,
      '',
      ...(post.subtitle ? [post.subtitle, ''] : []),
      `- Author: @${post.username}`,
      `- Published: ${formatDateOnly(post.publishedDate)}`,
      `- Updated: ${formatDateOnly(post.updatedDate)}`,
      `- Source: ${sourceUrl}`,
      ...(tags.length ? [`- Tags: ${tags.join(', ')}`] : []),
      '',
      '---',
      '',
      htmlToMarkdown(post.contentHtml),
    ];
    return sendMarkdown(reply, lines.join('\n'));
  });

  app.get<{ Params: { username: string; seriesUrl: string } }>('/@:username/series/:seriesUrl.md', async (request, reply) => {
    const setting = await readSiteSetting(db);
    if (!setting.aeoEnabled) return notFound(reply);
    const series = await readPublicSeries(db, request.params.username, request.params.seriesUrl);
    if (!series) return notFound(reply);
    if (series.username !== request.params.username) {
      return redirect(reply, request, `/@${encodeURIComponent(series.username)}/series/${encodeURIComponent(series.slug)}.md`);
    }
    const posts = await readPublicSeriesPosts(db, series.id);
    const sourceUrl = absoluteUrl(siteUrl, `/@${encodeURIComponent(series.username)}/series/${encodeURIComponent(series.slug)}`);
    const content = series.textMd.trim() && !looksLikeHtml(series.textMd)
      ? series.textMd.trim()
      : htmlToMarkdown(series.textHtml || series.textMd);
    const lines = [
      `# ${series.name}`,
      '',
      `- Author: @${series.username}`,
      `- Updated: ${formatDateOnly(series.updatedDate)}`,
      `- Source: ${sourceUrl}`,
      '',
      '---',
      '',
      ...(content ? [content, ''] : []),
      ...(posts.length ? [
        '## Posts',
        '',
        ...posts.map((post) => `- [${escapeMarkdownLinkText(post.title)}](${absoluteUrl(siteUrl, `/@${encodeURIComponent(post.username)}/${encodeURIComponent(post.slug)}.md`)}): Published ${formatDateOnly(post.publishedDate)}.`),
      ] : ['No public posts are available in this series.']),
    ];
    return sendMarkdown(reply, lines.join('\n'));
  });

  app.get<{ Params: { slug: string } }>('/static/:slug.md', async (request, reply) => {
    const setting = await readSiteSetting(db);
    if (!setting.aeoEnabled) return notFound(reply);
    const page = await db.staticPage.findFirst({
      where: { slug: request.params.slug, isPublished: true },
      select: { title: true, slug: true, content: true, updatedAt: true },
    });
    if (!page) return notFound(reply);
    const sourceUrl = absoluteUrl(siteUrl, `/static/${encodeURIComponent(page.slug)}`);
    const lines = [
      `# ${page.title}`,
      '',
      `- Updated: ${formatDateOnly(page.updatedAt)}`,
      `- Source: ${sourceUrl}`,
      '',
      '---',
      '',
      htmlToMarkdown(page.content),
    ];
    return sendMarkdown(reply, lines.join('\n'));
  });
}

async function readSiteSetting(db: PrismaClient): Promise<SiteSetting> {
  const setting = await db.siteSetting.findUnique({
    where: { id: 1 },
    select: { seoEnabled: true, aeoEnabled: true, robotsTxtExtraRules: true, siteName: true },
  });
  return setting ?? { seoEnabled: true, aeoEnabled: false, robotsTxtExtraRules: '', siteName: 'BLEX' };
}

function buildLlmsTxt(siteUrl: URL, setting: SiteSetting): string {
  const publicOrigin = siteUrl.origin;
  return [
    `# ${siteName(setting)}`,
    '',
    `> ${siteDescription(setting)}.`,
    '',
    '## Discovery',
    '',
    `- [Sitemap index](${absoluteUrl(siteUrl, '/sitemap.xml')}): Find public sitemap sections.`,
    `- [Posts sitemap](${absoluteUrl(siteUrl, '/posts/sitemap.xml')}): Find public posts without listing them here.`,
    `- [RSS feed](${absoluteUrl(siteUrl, '/rss')}): Read recent public posts.`,
    `- [Developer API OpenAPI schema](${absoluteUrl(siteUrl, '/api/developer/v1/openapi.json')}): Inspect the token-based authoring API contract.`,
    '',
    '## Markdown',
    '',
    `- Public post Markdown: \`${publicOrigin}/@{username}/{post_url}.md\``,
    `- Public series Markdown: \`${publicOrigin}/@{username}/series/{series_url}.md\``,
    `- Static page Markdown: \`${publicOrigin}/static/{slug}.md\``,
  ].join('\n').trim() + '\n';
}

async function readPublicPost(db: PrismaClient, username: string, slug: string): Promise<PublicPostRow | null> {
  const post = await db.post.findFirst({
    where: {
      slug,
      ...publicPostWhere(),
      author: { OR: [{ username }, { usernameChanges: { some: { username } } }] },
    },
    select: {
      id: true, title: true, subtitle: true, slug: true, publishedAt: true, updatedAt: true,
      author: { select: { username: true } },
      content: { select: { html: true } },
    },
  });
  if (!post) return null;
  return {
    id: post.id, username: post.author.username, title: post.title, subtitle: post.subtitle, slug: post.slug,
    publishedDate: post.publishedAt, updatedDate: post.updatedAt, contentHtml: post.content?.html ?? '',
  };
}

async function readPostTags(db: PrismaClient, postId: number): Promise<string[]> {
  const tags = await db.tag.findMany({ where: { posts: { some: { id: postId } } }, orderBy: { id: 'asc' }, select: { name: true } });
  return tags.map(({ name }) => name);
}

async function readPublicSeries(db: PrismaClient, username: string, slug: string): Promise<SeriesRow | null> {
  const series = await db.series.findFirst({
    where: {
      slug,
      isHidden: false,
      owner: { OR: [{ username }, { usernameChanges: { some: { username } } }] },
      posts: { some: publicPostWhere() },
    },
    select: { id: true, name: true, slug: true, descriptionMarkdown: true, descriptionHtml: true, updatedAt: true, owner: { select: { username: true } } },
  });
  if (!series) return null;
  return {
    id: series.id, username: series.owner.username, name: series.name, slug: series.slug,
    textMd: series.descriptionMarkdown, textHtml: series.descriptionHtml, updatedDate: series.updatedAt,
  };
}

async function readPublicSeriesPosts(db: PrismaClient, seriesId: number): Promise<Array<Pick<PublicPostRow, 'username' | 'title' | 'slug' | 'publishedDate'>>> {
  const posts = await db.post.findMany({
    where: { seriesId, ...publicPostWhere() },
    orderBy: { publishedAt: 'desc' },
    select: { title: true, slug: true, publishedAt: true, author: { select: { username: true } } },
  });
  return posts.map((post) => ({ username: post.author.username, title: post.title, slug: post.slug, publishedDate: post.publishedAt }));
}

async function findUser(db: PrismaClient, username: string): Promise<UserRow | null> {
  const user = await db.user.findUnique({ where: { username }, select: { id: true, username: true, name: true } });
  return user && { id: user.id, username: user.username, firstName: user.name };
}

async function findRenamedUsername(db: PrismaClient, username: string): Promise<string | null> {
  const renamed = await db.usernameChange.findFirst({
    where: { username },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { user: { select: { username: true } } },
  });
  return renamed?.user.username ?? null;
}

async function readFeedPosts(db: PrismaClient, authorId: number | null): Promise<FeedPostRow[]> {
  const posts = await db.post.findMany({
    where: { ...publicPostWhere(), ...(authorId === null ? {} : { authorId }) },
    orderBy: { publishedAt: 'desc' },
    take: 20,
    select: { title: true, slug: true, publishedAt: true, author: { select: { username: true } }, content: { select: { html: true } } },
  });
  return posts.map((post) => ({
    username: post.author.username, title: post.title, slug: post.slug, publishedDate: post.publishedAt, contentHtml: post.content?.html ?? '',
  }));
}

async function readAllSitemapMetadata(db: PrismaClient): Promise<Record<(typeof sitemapSections)[number], SitemapMetadata>> {
  const result = {} as Record<(typeof sitemapSections)[number], SitemapMetadata>;
  for (const section of sitemapSections) result[section] = await readSitemapMetadata(db, section);
  return result;
}

async function readSitemapMetadata(db: PrismaClient, section: (typeof sitemapSections)[number]): Promise<SitemapMetadata> {
  if (section === 'site') return { itemCount: 2, latestLastmod: null };
  const publicPost = publicPostWhere();
  if (section === 'user') {
    const itemCount = await db.user.count({ where: { profile: { role: 'EDITOR' }, posts: { some: publicPost } } });
    return { itemCount, latestLastmod: null };
  }
  if (section === 'posts') {
    const { _count, _max } = await db.post.aggregate({ where: publicPost, _count: { id: true }, _max: { updatedAt: true } });
    return { itemCount: _count.id, latestLastmod: _max.updatedAt };
  }
  if (section === 'series') {
    const { _count, _max } = await db.series.aggregate({
      where: { isHidden: false, posts: { some: publicPost } },
      _count: { id: true },
      _max: { updatedAt: true },
    });
    return { itemCount: _count.id, latestLastmod: _max.updatedAt };
  }
  const { _count, _max } = await db.staticPage.aggregate({
    where: { isPublished: true },
    _count: { id: true },
    _max: { updatedAt: true },
  });
  return { itemCount: _count.id, latestLastmod: _max.updatedAt };
}

async function readSitemapPage(
  db: PrismaClient,
  siteUrl: URL,
  section: (typeof sitemapSections)[number],
  page: number,
): Promise<SitemapUrl[]> {
  const offset = (page - 1) * sitemapLimit;
  const publicPost = publicPostWhere();
  if (section === 'site') {
    return [
      { location: siteUrl.origin, changefreq: 'weekly', priority: '1.0' },
      { location: absoluteUrl(siteUrl, '/tags'), changefreq: 'weekly', priority: '1.0' },
    ];
  }
  if (section === 'user') {
    const users = await db.user.findMany({
      where: { profile: { role: 'EDITOR' }, posts: { some: publicPost } },
      orderBy: { username: 'asc' },
      take: sitemapLimit,
      skip: offset,
      select: { username: true },
    });
    return users.map(({ username }) => ({
      location: absoluteUrl(siteUrl, `/@${encodeURIComponent(username)}`), changefreq: 'monthly', priority: '0.6',
    }));
  }
  if (section === 'posts') {
    const posts = await db.post.findMany({
      where: publicPost,
      orderBy: { updatedAt: 'desc' },
      take: sitemapLimit,
      skip: offset,
      select: { slug: true, updatedAt: true, author: { select: { username: true } } },
    });
    return posts.map((post) => ({
      location: absoluteUrl(siteUrl, `/@${encodeURIComponent(post.author.username)}/${encodeURIComponent(post.slug)}`),
      lastmod: post.updatedAt, changefreq: 'weekly', priority: '0.9',
    }));
  }
  if (section === 'series') {
    const series = await db.series.findMany({
      where: { isHidden: false, posts: { some: publicPost } },
      orderBy: { updatedAt: 'desc' },
      take: sitemapLimit,
      skip: offset,
      select: { slug: true, updatedAt: true, owner: { select: { username: true } } },
    });
    return series.map((item) => ({
      location: absoluteUrl(siteUrl, `/@${encodeURIComponent(item.owner.username)}/series/${encodeURIComponent(item.slug)}`),
      lastmod: item.updatedAt, changefreq: 'weekly', priority: '0.7',
    }));
  }
  const pages = await db.staticPage.findMany({
    where: { isPublished: true },
    orderBy: { updatedAt: 'desc' },
    take: sitemapLimit,
    skip: offset,
    select: { slug: true, updatedAt: true },
  });
  return pages.map((item) => ({
    location: absoluteUrl(siteUrl, `/static/${encodeURIComponent(item.slug)}`),
    lastmod: item.updatedAt, changefreq: 'monthly', priority: '0.8',
  }));
}

function buildRss(siteUrl: URL, posts: FeedPostRow[], channel: {
  title: string; link: string; description: string;
  image?: { url: string; title: string; link: string };
}): string {
  const image = channel.image
    ? `<image><url>${xmlEscape(channel.image.url)}</url><title>${xmlEscape(channel.image.title)}</title><link>${xmlEscape(channel.image.link)}</link></image>`
    : '';
  const items = posts.map((post) => {
    const description = stripControlCharacters(sanitizePostHtml(post.contentHtml));
    const link = absoluteUrl(siteUrl, `/@${encodeURIComponent(post.username)}/${encodeURIComponent(post.slug)}`);
    return `<item><title>${xmlEscape(post.title)}</title><link>${xmlEscape(link)}</link><description>${xmlEscape(description)}</description><guid isPermaLink="true">${xmlEscape(link)}</guid><pubDate>${xmlEscape((post.publishedDate ?? new Date(0)).toUTCString())}</pubDate></item>`;
  }).join('');
  return `<?xml version="1.0" encoding="utf-8"?>\n<rss version="2.0"><channel><title>${xmlEscape(channel.title)}</title><link>${xmlEscape(channel.link)}</link><description>${xmlEscape(channel.description)}</description><language>ko</language>${image}${items}</channel></rss>`;
}

function siteName(setting: SiteSetting): string {
  return (setting.siteName || 'BLEX').trim() || 'BLEX';
}

function siteDescription(setting: SiteSetting): string {
  const name = siteName(setting);
  return name === 'BLEX' ? 'BLOG EXPRESS ME' : `${name} recent public posts`;
}

function absoluteUrl(siteUrl: URL, path: string): string {
  return new URL(path, `${siteUrl.origin}/`).toString();
}

function sendMarkdown(reply: FastifyReply, content: string): FastifyReply {
  const body = `${content.replace(/\n{3,}/g, '\n\n').trim()}\n`;
  return reply.type('text/markdown; charset=utf-8')
    .header('X-Estimated-Tokens', String(estimateTokens(body)))
    .send(body);
}

function estimateTokens(content: string): number {
  return content ? Math.max(1, Math.ceil(content.length / 4)) : 0;
}

function notFound(reply: FastifyReply): FastifyReply {
  return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
}

function redirect(reply: FastifyReply, request: FastifyRequest, path: string): FastifyReply {
  const query = request.raw.url?.split('?', 2)[1];
  return reply.redirect(query ? `${path}?${query}` : path, 302);
}

function parsePage(value: string | undefined): number | null {
  if (value === undefined) return 1;
  if (!/^\d+$/.test(value)) return null;
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : null;
}

function formatDateOnly(value: DbDate): string {
  return value ? value.toISOString().slice(0, 10) : '';
}

function formatIsoDate(value: DbDate): string {
  return (value ?? new Date(0)).toISOString();
}

function latestDate(current: DbDate, candidate: DbDate): DbDate {
  if (!current || (candidate && candidate > current)) return candidate;
  return current;
}

function xmlEscape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function escapeMarkdownLinkText(value: string): string {
  return value.replace(/\[/g, '\\[').replace(/\]/g, '\\]');
}

function looksLikeHtml(value: string): boolean {
  return value.trimStart().startsWith('<');
}

function stripControlCharacters(value: string): string {
  return value.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F]/g, '');
}
