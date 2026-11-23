import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { authCookieOptions, csrfCookie, requestCookies } from '../../platform/cookies.js';
import { csrfPattern } from '../../platform/csrf.js';
import { createToken, type readSession } from '../auth/session.js';
import { relatedPosts } from '../authors/public-activity.js';
import { readReaderPostView } from '../engagement/index.js';
import { postContentSecurityPolicy, renderPublicPostPage } from './public-post-view.js';
import { publicPostPath, readPostPresentation, readPublicPost } from './public-post.js';

type PublicPostRouteOptions = {
  siteUrl: URL;
  writable: boolean;
  currentUser: (request: FastifyRequest) => ReturnType<typeof readSession>;
};

export function registerPublicPostRoute(app: FastifyInstance, db: PrismaClient, { siteUrl, writable, currentUser }: PublicPostRouteOptions) {
  app.get<{ Params: { username: string; slug: string } }>('/@:username/:slug', async (request, reply) => {
    const { username, slug } = request.params;
    const viewer = await currentUser(request);
    const post = await readPublicPost(db, username, slug, viewer?.id);
    if (!post) return reply.code(404).send('Not found');
    if (post.username !== username) return reply.redirect(publicPostPath(post.username, post.slug), 302);

    const presentation = await readPostPresentation(db, post);
    const publicArticle = writable && post.visibility === 'public';
    const canManage = viewer?.username === post.username && Boolean(viewer.hasEditorRole);
    const [reader, related, history] = await Promise.all([
      publicArticle || (writable && canManage && post.visibility !== 'draft')
        ? readReaderPostView(db, post.slug, viewer?.id ?? null, post.visibility !== 'public')
        : null,
      publicArticle && presentation.tags.length ? relatedPosts(db, post.id, post.authorId) : [],
      canManage ? db.postRevision.findFirst({ where: { postId: post.id }, select: { id: true } }) : null,
    ]);
    let csrf = requestCookies(request)[csrfCookie] ?? '';
    if (viewer) {
      reply.header('Cache-Control', 'private, no-store');
      if (!csrfPattern.test(csrf)) {
        csrf = createToken();
        reply.setCookie(csrfCookie, csrf, authCookieOptions(siteUrl));
      }
    }
    if (post.visibility !== 'public') reply.header('X-Robots-Tag', 'noindex, nofollow, noarchive');
    if (presentation.aeoEnabled && post.visibility === 'public') {
      const markdown = new URL(`${publicPostPath(post.username, post.slug)}.md`, siteUrl);
      const llms = new URL('/llms.txt', siteUrl);
      reply.header('Link', `<${markdown.href}>; rel="alternate"; type="text/markdown", <${llms.href}>; rel="llms-txt"`);
      reply.header('X-Llms-Txt', llms.href);
    }
    return reply.type('text/html; charset=utf-8')
      .header('Vary', 'Cookie')
      .header('Content-Security-Policy', postContentSecurityPolicy)
      .send(renderPublicPostPage(post, presentation, siteUrl, reader, csrf, canManage, viewer, related, undefined, history !== null));
  });
}
