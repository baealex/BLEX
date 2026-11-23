import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { syncPostPublication } from '../../notifications/model.js';
import { localDate, timeSince } from '../../../platform/date-format.js';
import { readDraftPreview, readPostPresentation } from '../public-post.js';
import { postContentSecurityPolicy, renderPublicPostPage } from '../public-post-view.js';
import { sanitizePostHtml } from '../post-html.js';
import { done, failure as failed } from '../../../platform/response.js';
import {
  editorBodyLimit,
  editorMultipartLimit,
  editorKeepsOriginalTags,
  isMultipartRequest,
  prepareEditorFields,
  readEditorForm,
} from '../services/editor-form.js';
import { apiPostBase, preservePostOmissions } from '../services/author-api.js';
import { mediaUrl, parseAuthoringPostInput } from '../services/post-content.js';
import {
  PostValidationError,
  createPost,
  draftReservation,
  loadPost,
  postPublic,
  postTags,
  trashPost,
  updatePost,
  updatePostSettings,
} from '../services/post-store.js';
import {
  type AuthoringOptions,
  cookieValue,
  currentAccount,
  editorAccount,
  field,
  forbidden,
  localDateTime,
  notFound,
  queryObject,
} from '../shared.js';

export function registerEditorRoutes(routes: FastifyInstance, db: PrismaClient, options: AuthoringOptions) {
  // Large draft bodies are only parsed for a signed-in session.
  const sessionBeforeBody = async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.method === 'GET' || request.method === 'HEAD' || (await options.currentUser(request))) return;
    return reply.send(failed('NL', 'Login required.'));
  };

  // The screen host mounts these pages for their owner, so every other reader gets the login, role, or 404 answer.
  routes.get('/write', async (request, reply) => {
    const account = await editorAccount(request, reply, db, options, false);
    return account ? notFound(reply) : reply;
  });

  routes.get<{ Params: { username: string; slug: string } }>('/@:username/:slug/edit', async (request, reply) => {
    const account = await editorAccount(request, reply, db, options, false);
    return account ? notFound(reply) : reply;
  });

  routes.get<{ Params: { slug: string } }>('/write/preview/:slug', async (request, reply) => {
    const account = await currentAccount(request, db, options);
    if (!account || account.role !== 'EDITOR') return notFound(reply);
    const post = await readDraftPreview(db, account.id, request.params.slug);
    if (!post) return notFound(reply);
    const presentation = await readPostPresentation(db, post);
    const csrf = cookieValue(request, 'csrftoken');
    return reply
      .type('text/html; charset=utf-8')
      .header('Cache-Control', 'private, no-store')
      .header('X-Robots-Tag', 'noindex, nofollow')
      .header('Content-Security-Policy', postContentSecurityPolicy)
      .send(
        renderPublicPostPage(
          post,
          presentation,
          options.siteUrl,
          null,
          csrf,
          false,
          {
            username: post.username,
            hasEditorRole: true,
            isStaff: post.isStaff,
            unreadCount: post.unreadCount,
          },
          [],
          { bio: post.authorBio, homepage: post.authorHomepage },
        ),
      );
  });

  routes.post('/v1/posts', { config: { multipartLimit: editorMultipartLimit } }, async (request, reply) => {
    // A multipart body carries its token inside, so it is read only after the author is known.
    if (!isMultipartRequest(request) && !options.validateCsrf(request)) return forbidden(reply);
    const user = await currentAccount(request, db, options);
    if (!user) return notFound(reply);
    if (user.role !== 'EDITOR') return failed('RJ', 'Author access is required.');
    const form = await readEditorForm(request);
    if (!options.validateCsrf(request)) return forbidden(reply);
    const body = form.body;
    try {
      const draftUrl = field(body.draftUrl);
      const draft = draftUrl ? await loadPost(db, { userId: user.id, slug: draftUrl }) : null;
      if (draftUrl && (!draft || draft.publishedDate !== null)) return notFound(reply);
      if (form.isMultipart) {
        const uploadError = await prepareEditorFields(db, options, user, form);
        if (uploadError) return failed('RJ', uploadError);
      }
      const input = parseAuthoringPostInput(body);
      if (draft && form.isMultipart && !Object.hasOwn(body, 'series') && !Object.hasOwn(body, 'seriesUrl')) {
        input.series = draft.seriesUrl ?? '';
      }
      const post = draft
        ? await updatePost(db, user, draft, input, {
            allowEmptyBody: false,
            publishDraft: true,
            preserveTags: await editorKeepsOriginalTags(db, draft, body),
          })
        : await createPost(db, user, input, false);
      return done({ url: post.url });
    } catch (error) {
      if (error instanceof PostValidationError) return failed(error.code, error.message);
      request.log.error(error);
      return failed('RJ', 'Could not create the post.');
    }
  });

  routes.route<{ Params: { username: string; url: string } }>({
    method: ['GET', 'POST', 'PUT', 'DELETE'],
    url: '/v1/users/@:username/posts/:url',
    config: { multipartLimit: editorMultipartLimit },
    handler: async (request, reply) => {
      if (request.method === 'GET') {
        const post = await loadPost(db, { username: request.params.username, slug: request.params.url });
        if (!post) return notFound(reply);
        const viewer = await currentAccount(request, db, options);
        const mode = field(queryObject(request).mode);
        if (mode === 'edit') {
          if (!viewer || viewer.role !== 'EDITOR' || viewer.id !== post.authorId) return notFound(reply);
          const content = sanitizePostHtml(post.contentHtml);
          const tags = await postTags(db, post.id);
          return done({ ...apiPostBase(post, content), tags });
        }
        if (mode !== 'view' || (!postPublic(post) && viewer?.id !== post.authorId)) return notFound(reply);
        const tags = await postTags(db, post.id);
        const countComments = await db.comment.count({ where: { postId: post.id } });
        const [countLikes, liked] = await Promise.all([
          db.postLike.count({ where: { postId: post.id } }),
          viewer
            ? db.postLike.findUnique({
                where: { postId_userId: { postId: post.id, userId: viewer.id } },
                select: { postId: true },
              })
            : null,
        ]);
        return done({
          url: post.url,
          title: post.title,
          image: post.image,
          description: post.description,
          readTime: post.readTime,
          series: post.seriesUrl && !post.seriesHidden ? { url: post.seriesUrl, name: post.seriesName } : null,
          createdDate: localDateTime(post.publishedDate),
          updatedDate: localDateTime(post.updatedDate),
          authorImage: post.authorAvatar ?? '',
          author: post.authorUsername,
          renderedContent: sanitizePostHtml(post.contentHtml),
          countLikes,
          countComments,
          isAd: post.advertise,
          coverLayout: post.coverLayout,
          coverImagePosition: post.coverImagePosition,
          coverImageRatio: post.coverImageRatio,
          tags,
          isLiked: liked !== null,
        });
      }

      const user = await editorAccount(request, reply, db, options, true);
      if (!user) return reply;
      const form = await readEditorForm(request);
      if (!options.validateCsrf(request)) return forbidden(reply);
      const author = await db.user.findUnique({ where: { username: request.params.username }, select: { id: true } });
      if (!author || author.id !== user.id) return notFound(reply);
      const post = await loadPost(db, { userId: user.id, slug: request.params.url });
      if (!post) return notFound(reply);
      const body = form.body;

      if (request.method === 'DELETE') {
        const deletedDate = await trashPost(db, user, post);
        return done({ trashed: true, deletedDate });
      }
      if (request.method === 'PUT') {
        try {
          const result = await updatePostSettings(db, user, post, queryObject(request), body);
          return result ? done(result) : notFound(reply);
        } catch (error) {
          if (error instanceof PostValidationError) return failed(error.code, error.message);
          throw error;
        }
      }

      try {
        if (form.isMultipart) {
          const uploadError = await prepareEditorFields(db, options, user, form);
          if (uploadError) return failed('RJ', uploadError);
        }
        let input = parseAuthoringPostInput(body);
        if (post.publishedDate === null) input = await preservePostOmissions(db, post, body, input);
        else {
          if (!Object.hasOwn(body, 'coverLayout')) input.coverLayout = post.coverLayout;
          if (!Object.hasOwn(body, 'coverImagePosition')) input.coverImagePosition = post.coverImagePosition;
          if (!Object.hasOwn(body, 'coverImageRatio')) input.coverImageRatio = post.coverImageRatio;
          if (!Object.hasOwn(body, 'blockComment')) input.blockComment = post.blockComment;
        }
        if (form.isMultipart) {
          // The editor form leaves these out to mean "unchanged" and sends them empty to clear them.
          if (!Object.hasOwn(body, 'series')) input.series = post.seriesUrl ?? '';
          if (!Object.hasOwn(body, 'isAdvertise') && !Object.hasOwn(body, 'advertise'))
            input.advertise = post.advertise;
        }
        await updatePost(db, user, post, input, {
          allowEmptyBody: post.publishedDate === null,
          updateDraft: post.publishedDate === null,
          preserveTags: form.isMultipart && !Object.hasOwn(body, 'tag'),
        });
        return done();
      } catch (error) {
        if (error instanceof PostValidationError) return failed(error.code, error.message);
        request.log.error(error);
        return failed('RJ', 'Could not update the post.');
      }
    },
  });

  routes.route({
    method: ['GET', 'POST'],
    url: '/v1/drafts',
    bodyLimit: editorBodyLimit,
    config: { bodyAccess: 'author', multipartLimit: editorMultipartLimit },
    onRequest: sessionBeforeBody,
    handler: async (request, reply) => {
      const user = await editorAccount(request, reply, db, options, true);
      if (!user) return reply;
      if (request.method === 'GET') {
        const drafts = await db.post.findMany({
          where: { authorId: user.id, deletedAt: null, publishedAt: null },
          orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
          select: { slug: true, title: true, image: true, createdAt: true, updatedAt: true },
        });
        return done({
          drafts: drafts.map((draft) => ({
            url: draft.slug,
            title: draft.title,
            image: draft.image || null,
            createdDate: timeSince(draft.createdAt),
            updatedDate: localDate(draft.updatedAt),
          })),
        });
      }
      const form = await readEditorForm(request);
      if (!options.validateCsrf(request)) return forbidden(reply);
      try {
        const uploadError = await prepareEditorFields(db, options, user, form);
        if (uploadError) return failed('RJ', uploadError);
        const post = await createPost(db, user, parseAuthoringPostInput(form.body), true);
        return done({ url: post.url });
      } catch (error) {
        if (error instanceof PostValidationError) return failed(error.code, error.message);
        request.log.error(error);
        return failed('RJ', 'Could not save the draft.');
      }
    },
  });

  routes.route<{ Params: { url: string } }>({
    method: ['GET', 'PUT', 'DELETE'],
    url: '/v1/drafts/:url',
    bodyLimit: editorBodyLimit,
    config: { bodyAccess: 'author', multipartLimit: editorMultipartLimit },
    onRequest: sessionBeforeBody,
    handler: async (request, reply) => {
      const user = await editorAccount(request, reply, db, options, true);
      if (!user) return reply;
      const post = await loadPost(db, { userId: user.id, slug: request.params.url });
      if (!post || post.publishedDate !== null) return notFound(reply);
      if (request.method === 'GET') {
        const tags = await postTags(db, post.id);
        return done({
          url: post.url,
          title: post.title,
          subtitle: post.subtitle,
          contentHtml: sanitizePostHtml(post.contentHtml),
          textMd: sanitizePostHtml(post.contentHtml),
          rawContent: sanitizePostHtml(post.contentHtml),
          tags: tags.join(','),
          description: post.description,
          image: mediaUrl(post.image),
          coverLayout: post.coverLayout,
          coverImagePosition: post.coverImagePosition,
          coverImageRatio: post.coverImageRatio,
          isHide: post.hide,
          isAdvertise: post.advertise,
          blockComment: post.blockComment,
          reservedDate: await draftReservation(db, post.id),
          series: post.seriesUrl ? { url: post.seriesUrl, name: post.seriesName } : null,
          createdDate: timeSince(post.createdDate),
        });
      }
      const form = request.method === 'DELETE' ? { body: {}, isMultipart: false } : await readEditorForm(request);
      if (!options.validateCsrf(request)) return forbidden(reply);
      if (request.method === 'DELETE') {
        const deletedDate = await trashPost(db, user, post);
        return done({ trashed: true, deletedDate });
      }
      try {
        const uploadError = await prepareEditorFields(db, options, user, form);
        if (uploadError) return failed('RJ', uploadError);
        const body = form.body;
        await updatePost(db, user, post, await preservePostOmissions(db, post, body, parseAuthoringPostInput(body)), {
          allowEmptyBody: true,
          updateDraft: true,
          preserveTags: !Object.hasOwn(body, 'tags') && !Object.hasOwn(body, 'tag'),
        });
        return done({ url: post.url });
      } catch (error) {
        if (error instanceof PostValidationError) return failed(error.code, error.message);
        request.log.error(error);
        return failed('RJ', 'Could not update the draft.');
      }
    },
  });

  routes.route<{ Params: { username: string; url: string; action: 'cancel' | 'publish-now' } }>({
    method: 'POST',
    url: '/v1/users/@:username/posts/:url/schedule/:action',
    handler: async (request, reply) => {
      const user = await editorAccount(request, reply, db, options, true);
      if (!user) return reply;
      if (!options.validateCsrf(request)) return forbidden(reply);
      const post = await loadPost(db, { username: request.params.username, slug: request.params.url });
      if (!post || post.authorId !== user.id) return notFound(reply);
      if (!post.publishedDate || post.publishedDate.valueOf() <= Date.now()) {
        return failed('RJ', 'This action is only available for scheduled posts.');
      }
      if (request.params.action !== 'cancel' && request.params.action !== 'publish-now') return notFound(reply);
      const publishDate = request.params.action === 'cancel' ? null : new Date();
      const updated = new Date();
      await db.$transaction(async (tx) => {
        await tx.post.updateMany({
          where: { id: post.id, authorId: user.id },
          data: { publishedAt: publishDate, updatedAt: updated },
        });
        await syncPostPublication(tx, post.id, { announce: true });
      });
      return done(
        request.params.action === 'cancel'
          ? { url: post.url, status: 'draft' }
          : { url: post.url, status: 'published', publishedDate: publishDate?.toISOString() },
      );
    },
  });
}
