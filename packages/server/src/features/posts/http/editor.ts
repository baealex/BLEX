import { type PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { syncPostPublication } from '../../notifications/model.js';
import { localDate, timeSince } from '../../../compat/django-format.js';
import { readDraftPreview, readPostPresentation } from '../public-post.js';
import { postContentSecurityPolicy, renderPublicPostPage } from '../pages/public-post-page.js';
import { sanitizePostHtml } from '../post-html.js';
import { done, failure as failed } from '../../../platform/response.js';
import { editorBodyLimit, editorKeepsOriginalTags, isMultipartRequest, prepareEditorFields, readEditorForm } from '../services/editor-form.js';
import { apiPostBase, preservePostOmissions } from '../services/author-api.js';
import { mediaUrl, parseAuthoringPostInput } from '../services/post-content.js';
import { PostValidationError, createPost, draftReservation, loadPost, postPublic, postTags, trashPost, updatePost, updatePostSettings } from '../services/post-store.js';
import { AuthoringOptions, DbBoolean, StoredDraftSummary, cookieValue, currentAccount, dateAsIso, editorAccount, field, forbidden, isTrue, localDateTime, notFound, nowString, numberValue, queryObject } from '../shared.js';

export function registerEditorRoutes(routes: FastifyInstance, db: PrismaClient, options: AuthoringOptions) {
    // Large draft bodies are only parsed for a signed-in session.
    const sessionBeforeBody = async (request: FastifyRequest, reply: FastifyReply) => {
      if (request.method === 'GET' || request.method === 'HEAD' || await options.currentUser(request)) return;
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
      return reply.type('text/html; charset=utf-8')
        .header('Cache-Control', 'private, no-store')
        .header('X-Robots-Tag', 'noindex, nofollow')
        .header('Content-Security-Policy', postContentSecurityPolicy)
        .send(renderPublicPostPage(post, presentation, options.siteUrl, null, csrf, false, {
          username: post.username, hasEditorRole: true, isStaff: Boolean(Number(post.isStaff)), unreadCount: Number(post.unreadCount),
        }, [], { bio: post.authorBio, homepage: post.authorHomepage }));
    });

    routes.post('/v1/posts', async (request, reply) => {
      // A multipart body carries its token inside, so it is read only after the author is known.
      if (!isMultipartRequest(request) && !options.validateCsrf(request)) return forbidden(reply);
      const user = await currentAccount(request, db, options);
      if (!user) return notFound(reply);
      if (user.role !== 'EDITOR') return failed('RJ', 'Author access is required.');
      const form = await readEditorForm(request);
      if (!options.validateCsrf(request)) return forbidden(reply);
      const body = form.body;
      try {
        const draftUrl = field(body.draft_url);
        const draft = draftUrl ? await loadPost(db, { userId: user.id, slug: draftUrl }) : null;
        if (draftUrl && (!draft || draft.publishedDate !== null)) return notFound(reply);
        if (form.isMultipart) {
          const uploadError = await prepareEditorFields(db, options, user, form);
          if (uploadError) return failed('RJ', uploadError);
        }
        const input = parseAuthoringPostInput(body);
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
          const counts = await db.$queryRaw<Array<{ likes: number | bigint; liked: DbBoolean }>>`
            SELECT (SELECT COUNT(*) FROM board_post_likes WHERE post_id = ${post.id}) AS likes,
                   CASE WHEN EXISTS (
                     SELECT 1 FROM board_post_likes
                     WHERE post_id = ${post.id} AND user_id = ${viewer?.id ?? -1}
                   ) THEN 1 ELSE 0 END AS liked
          `;
          return done({
            url: post.url,
            title: post.title,
            image: post.image,
            description: post.description,
            readTime: post.readTime,
            series: post.seriesUrl && !isTrue(post.seriesHidden) ? { url: post.seriesUrl, name: post.seriesName } : null,
            createdDate: localDateTime(post.publishedDate),
            updatedDate: localDateTime(post.updatedDate),
            authorImage: post.authorAvatar ?? '',
            author: post.authorUsername,
            renderedContent: sanitizePostHtml(post.contentHtml),
            countLikes: numberValue(counts[0]?.likes),
            countComments,
            isAd: isTrue(post.advertise),
            coverLayout: post.coverLayout,
            coverImagePosition: post.coverImagePosition,
            coverImageRatio: post.coverImageRatio,
            tags,
            isLiked: isTrue(counts[0]?.liked ?? 0),
          });
        }

        const user = await editorAccount(request, reply, db, options, true);
        if (!user) return reply;
        const form = await readEditorForm(request);
        if (!options.validateCsrf(request)) return forbidden(reply);
        const authors = await db.$queryRaw<Array<{ id: number }>>`
          SELECT id FROM auth_user WHERE username = ${request.params.username} LIMIT 1
        `;
        if (!authors[0] || authors[0].id !== user.id) return notFound(reply);
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
            if (!Object.hasOwn(body, 'cover_layout')) input.coverLayout = post.coverLayout;
            if (!Object.hasOwn(body, 'cover_image_position')) input.coverImagePosition = post.coverImagePosition;
            if (!Object.hasOwn(body, 'cover_image_ratio')) input.coverImageRatio = post.coverImageRatio;
            if (!Object.hasOwn(body, 'block_comment')) input.blockComment = isTrue(post.blockComment);
          }
          if (form.isMultipart) {
            // The editor form leaves these out to mean "unchanged", while JSON clients replace them.
            if (!field(body.series)) input.series = post.seriesUrl ?? '';
            if (!Object.hasOwn(body, 'is_advertise') && !Object.hasOwn(body, 'advertise')) input.advertise = isTrue(post.advertise);
          }
          await updatePost(db, user, post, input, {
            allowEmptyBody: post.publishedDate === null,
            updateDraft: post.publishedDate === null,
            preserveTags: form.isMultipart && !field(body.tag),
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
      onRequest: sessionBeforeBody,
      handler: async (request, reply) => {
        const user = await editorAccount(request, reply, db, options, true);
        if (!user) return reply;
        if (request.method === 'GET') {
          const drafts = await db.$queryRaw<StoredDraftSummary[]>`
            SELECT url, title, image,
                   CAST(created_date AS TEXT) AS createdDate,
                   CAST(updated_date AS TEXT) AS updatedDate
            FROM board_post
            WHERE author_id = ${user.id} AND deleted_date IS NULL AND published_date IS NULL
            ORDER BY updated_date DESC, id DESC
          `;
          return done({ drafts: drafts.map((draft) => ({
            url: draft.url,
            title: draft.title,
            image: draft.image || null,
            createdDate: draft.createdDate ? timeSince(draft.createdDate) : null,
            updatedDate: localDate(draft.updatedDate),
          })) });
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
            isHide: isTrue(post.hide),
            isAdvertise: isTrue(post.advertise),
            blockComment: isTrue(post.blockComment),
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
        const published = dateAsIso(post.publishedDate);
        if (!published || new Date(published).valueOf() <= Date.now()) {
          return failed('RJ', 'This action is only available for scheduled posts.');
        }
        if (request.params.action !== 'cancel' && request.params.action !== 'publish-now') return notFound(reply);
        const publishDate = request.params.action === 'cancel' ? null : nowString();
        const updated = nowString();
        await db.$transaction(async (tx) => {
          await tx.$executeRaw`
            UPDATE board_post SET published_date = ${publishDate}, updated_date = ${updated}
            WHERE id = ${post.id} AND author_id = ${user.id}
          `;
          await syncPostPublication(tx, post.id, { announce: true });
        });
        return done(request.params.action === 'cancel'
          ? { url: post.url, status: 'draft' }
          : { url: post.url, status: 'published', publishedDate: publishDate?.replace(' ', 'T') + 'Z' });
      },
    });
}
