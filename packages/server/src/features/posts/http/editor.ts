import { type PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { syncPostPublication } from '../../notifications/model.js';
import { localDate, timeSince } from '../../../compat/django-format.js';
import { readDraftPreview, readPostPresentation } from '../public-post.js';
import { postContentSecurityPolicy, renderPublicPostPage } from '../pages/public-post-page.js';
import { sanitizePostHtml } from '../post-html.js';
import { done, failure as failed } from '../../../platform/response.js';
import { editorKeepsOriginalContent, editorModel, inputFromEditorForm, sendEditorPage } from '../pages/editor-page.js';
import { editorBodyLimit, editorKeepsOriginalTags, isMultipartRequest, prepareEditorFields, readEditorForm } from '../services/editor-form.js';
import { apiPostBase, preservePostOmissions } from '../services/author-api.js';
import { mediaUrl, parseAuthoringPostInput } from '../services/post-content.js';
import { AuthoringSaveResult, PostValidationError, createPost, draftReservation, getSeriesOptions, loadPost, postPublic, postTags, trashPost, updatePost, updatePostSettings } from '../services/post-store.js';
import { AuthoringOptions, DbBoolean, StoredDraftSummary, StoredPost, bodyObject, booleanField, cookieValue, currentAccount, dateAsIso, editorAccount, editorRedirect, field, forbidden, isTrue, localDateTime, notFound, nowString, numberValue, queryObject } from '../shared.js';

export function registerEditorRoutes(routes: FastifyInstance, db: PrismaClient, options: AuthoringOptions) {
    // Large editor bodies are only parsed for a signed-in session.
    const sessionBeforeBody = async (request: FastifyRequest, reply: FastifyReply) => {
      if (request.method === 'GET' || request.method === 'HEAD' || await options.currentUser(request)) return;
      if (request.url.startsWith('/v1/')) return reply.send(failed('NL', 'Login required.'));
      editorRedirect(reply, false);
      return reply;
    };

    routes.route({
      method: ['GET', 'POST'],
      url: '/write',
      bodyLimit: editorBodyLimit,
      onRequest: sessionBeforeBody,
      handler: async (request, reply) => {
        const account = await editorAccount(request, reply, db, options, false);
        if (!account) return reply;
        // The screen host mounts this page for editors, so only unrecognized URL spellings reach here.
        if (request.method !== 'POST') return notFound(reply);
        const seriesOptions = await getSeriesOptions(db, account.id);
        const csrfToken = cookieValue(request, 'csrftoken');
        const form = await readEditorForm(request);
        if (!options.validateCsrf(request)) return forbidden(reply);
        const body = form.body;
        const uploadError = await prepareEditorFields(db, options, account, form);
        if (uploadError) return reply.redirect(field(body.draft_url) ? `/write?draft=${encodeURIComponent(field(body.draft_url))}` : '/write', 303);
        const input = inputFromEditorForm(body);
        const savesDraft = field(body.is_draft) === 'true';
        const action = field(body.action) || (savesDraft ? 'draft' : 'publish');
        const draftUrl = field(body.draft_url);
        let existingDraft: StoredPost | null = null;
        if (draftUrl) {
          existingDraft = await loadPost(db, { userId: account.id, slug: draftUrl });
          if (!existingDraft || existingDraft.publishedDate !== null) return notFound(reply);
        }
        if (action === 'delete' && existingDraft) {
          await trashPost(db, account, existingDraft);
          return reply.redirect(`/@${encodeURIComponent(account.username)}`, 302);
        }
        try {
          let saved: AuthoringSaveResult;
          if (action === 'draft') {
            saved = existingDraft
              ? await updatePost(db, account, existingDraft, input, {
                allowEmptyBody: true,
                updateDraft: true,
                preserveExistingHtml: editorKeepsOriginalContent(existingDraft, body),
                preserveTags: await editorKeepsOriginalTags(db, existingDraft, body),
              })
              : await createPost(db, account, input, true);
            if (savesDraft) return reply.redirect(`/@${encodeURIComponent(account.username)}/${encodeURIComponent(saved.url)}/edit`, 302);
            return reply.redirect(`/write?draft=${encodeURIComponent(saved.url)}&saved=1`, 302);
          }
          if (existingDraft) {
            saved = await updatePost(db, account, existingDraft, input, {
              allowEmptyBody: false,
              publishDraft: true,
              preserveExistingHtml: editorKeepsOriginalContent(existingDraft, body),
              preserveTags: await editorKeepsOriginalTags(db, existingDraft, body),
            });
          } else {
            saved = await createPost(db, account, input, false);
          }
          return reply.redirect(`/@${encodeURIComponent(account.username)}/${encodeURIComponent(saved.url)}`, 302);
        } catch (error) {
          const message = error instanceof PostValidationError ? error.message : '글을 저장하지 못했습니다.';
          const currentDraft = existingDraft;
          await sendEditorPage(reply, editorModel(account, csrfToken, seriesOptions, {
            isDraft: action === 'draft' || Boolean(currentDraft),
            postUrl: currentDraft?.url ?? field(body.url),
            title: field(body.title),
            subtitle: field(body.subtitle),
            content: field(body.text_md),
            contentType: field(body.content_type) === 'html' ? 'html' : 'markdown',
            description: field(body.meta_description),
            tags: field(body.tag),
            series: field(body.series),
            coverImageUrl: field(body.cover_image_url),
            hide: booleanField(body.hide),
            blockComment: booleanField(body.block_comment),
            reservedDate: field(body.reserved_date),
            errorMessage: message,
          }), 400, options.editorAssets);
          return reply;
        }
      },
    });

    routes.route<{ Params: { username: string; slug: string } }>({
      method: ['GET', 'POST'],
      url: '/@:username/:slug/edit',
      bodyLimit: editorBodyLimit,
      onRequest: sessionBeforeBody,
      handler: async (request, reply) => {
        const account = await editorAccount(request, reply, db, options, false);
        if (!account) return reply;
        // The screen host mounts this page for the owner, so other readers get the same 404 as a missing post.
        if (request.method !== 'POST') return notFound(reply);
        const form = await readEditorForm(request);
        if (!options.validateCsrf(request)) return forbidden(reply);
        const post = await loadPost(db, { username: request.params.username, slug: request.params.slug });
        if (!post || post.authorId !== account.id) return notFound(reply);
        const body = form.body;
        const isAsyncSubmit = request.headers['x-blex-editor-submit'] === 'async';
        const action = field(body.delete) === 'true' ? 'delete' : field(body.action) || 'publish';
        if (action === 'delete') {
          await trashPost(db, account, post);
          return reply.redirect(`/@${encodeURIComponent(account.username)}`, 302);
        }
        const uploadError = await prepareEditorFields(db, options, account, form);
        if (uploadError) return isAsyncSubmit ? failed('RJ', uploadError) : reply.redirect(`/@${encodeURIComponent(account.username)}/${encodeURIComponent(post.url)}/edit`, 303);
        const parsedInput = inputFromEditorForm(body);
        // The editor form has no advertising control, so an omitted flag keeps the stored value.
        const keepsAdvertise = !Object.hasOwn(body, 'is_advertise') && !Object.hasOwn(body, 'advertise');
        const input = keepsAdvertise ? { ...parsedInput, advertise: isTrue(post.advertise) } : parsedInput;
        if (isAsyncSubmit) {
          // A 3.x edit that omits the series or tags keeps the stored values.
          if (!field(body.series)) input.series = post.seriesUrl ?? '';
        }
        try {
          if (isAsyncSubmit) {
            await updatePost(db, account, post, input, {
              allowEmptyBody: post.publishedDate === null,
              updateDraft: post.publishedDate === null,
              preserveTags: !field(body.tag),
            });
            return done({ url: `/@${encodeURIComponent(account.username)}/${encodeURIComponent(post.url)}` });
          }
          if (post.publishedDate === null && action === 'publish') {
            const saved = await updatePost(db, account, post, input, {
              allowEmptyBody: false,
              publishDraft: true,
              preserveExistingHtml: editorKeepsOriginalContent(post, body),
              preserveTags: await editorKeepsOriginalTags(db, post, body),
            });
            return reply.redirect(`/@${encodeURIComponent(account.username)}/${encodeURIComponent(saved.url)}`, 302);
          }
          await updatePost(db, account, post, input, {
            allowEmptyBody: post.publishedDate === null,
            updateDraft: post.publishedDate === null,
            preserveExistingHtml: editorKeepsOriginalContent(post, body),
            preserveTags: await editorKeepsOriginalTags(db, post, body),
          });
          return reply.redirect(`/@${encodeURIComponent(account.username)}/${encodeURIComponent(post.url)}/edit`, 302);
        } catch (error) {
          if (isAsyncSubmit && error instanceof PostValidationError) return failed(error.code, error.message);
          const message = error instanceof PostValidationError ? error.message : '글을 저장하지 못했습니다.';
          await sendEditorPage(reply, editorModel(account, cookieValue(request, 'csrftoken'), await getSeriesOptions(db, account.id), {
            isEdit: true,
            isDraft: post.publishedDate === null,
            postUrl: post.url,
            title: field(body.title),
            subtitle: field(body.subtitle),
            content: field(body.text_md),
            contentType: field(body.content_type) === 'html' ? 'html' : 'markdown',
            description: field(body.meta_description),
            tags: field(body.tag),
            series: field(body.series),
            coverImageUrl: field(body.cover_image_url),
            hide: booleanField(body.hide),
            blockComment: booleanField(body.block_comment),
            reservedDate: field(body.reserved_date),
            showSchedule: post.publishedDate === null || Boolean(
              dateAsIso(post.publishedDate) && new Date(dateAsIso(post.publishedDate)!).valueOf() > Date.now(),
            ),
            errorMessage: message,
          }), 400, options.editorAssets);
          return reply;
        }
      },
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
          const counts = await db.$queryRaw<Array<{ likes: number | bigint; comments: number | bigint; liked: DbBoolean }>>`
            SELECT (SELECT COUNT(*) FROM board_post_likes WHERE post_id = ${post.id}) AS likes,
                   (SELECT COUNT(*) FROM board_comment WHERE post_id = ${post.id}) AS comments,
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
            countComments: numberValue(counts[0]?.comments),
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
