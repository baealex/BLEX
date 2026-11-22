import formBody from '@fastify/formbody';
import { Prisma, type PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { createNotification } from '../notifications/model.js';
import { decryptDjangoSecret } from '../auth/django-secret.js';
import { timeSince } from '../../compat/django-format.js';
import { publicPostPath } from '../posts/public-post.js';
import { done, failure as error } from '../../platform/response.js';
import { CommentRow, commentBodyLimit, commentForViewer, commentHtml, publicComments, serializeComment } from './services/comments.js';
import { anonymizeComments } from './services/deletions.js';
import { canSubscribe, mySubscriptions, subscriptionState } from './services/subscriptions.js';
import { ReaderActionsOptions, activeEditor, activeUser, asBodyObject, bodyField, commentReturnTo, forbidden, isTrue, localReturnTo, missing, publicPost, requestCsrfAccepted, textValue, truthyBodyField } from './shared.js';

export { ReaderActionUser, ReaderActionsOptions } from './shared.js';
export { CommentPayload } from './services/comments.js';
export { mySubscriptions } from './services/subscriptions.js';
export { ReaderAuthorHeader, ReaderPostLikeState, ReaderPostView, readReaderPostView } from './services/reader-view.js';

export { timeSince };

/** Another request already wrote this row. SQLite keeps the transaction open after the conflict. */
async function createUnlessPresent(create: () => Promise<unknown>): Promise<boolean> {
  try {
    await create();
    return true;
  } catch (failure) {
    if (failure instanceof Prisma.PrismaClientKnownRequestError && failure.code === 'P2002') return false;
    throw failure;
  }
}

export function registerReaderActions(
  app: FastifyInstance,
  db: PrismaClient,
  options: ReaderActionsOptions,
): void {
  app.register(async (routes) => {
    await routes.register(formBody);
    routes.removeContentTypeParser('application/json');
    routes.addContentTypeParser('application/json', { parseAs: 'string' }, (_request, body, doneParse) => {
      try {
        doneParse(null, JSON.parse(body as string));
      } catch {
        // The legacy PUT API falls back to a QueryDict when its JSON body is malformed.
        doneParse(null, body as string);
      }
    });

    routes.post<{ Params: { url: string } }>('/like/:url', async (request, reply) => {
      if (!requestCsrfAccepted(request, options)) return forbidden(reply);
      const user = await activeUser(request, db, options);
      if (!user) {
        return reply.code(401).send({ status: 'error', message: 'Authentication required' });
      }
      const post = await publicPost(db, request.params.url);
      if (!post) return missing(reply);

      const result = await db.$transaction(async (tx) => {
        const like = { postId: post.id, userId: user.id };
        const removed = await tx.postLike.deleteMany({ where: like });
        let hasLiked = false;
        if (removed.count > 0) {
          hasLiked = false;
        } else {
          const added = await createUnlessPresent(() => tx.postLike.create({ data: { ...like, createdAt: new Date() } }));
          if (added) await createNotification(tx, {
            recipientId: post.authorId, actor: user.username, url: publicPostPath(post.authorUsername, post.slug), title: post.title,
            key: 'post.liked', preference: 'NOTIFY_POSTS_LIKE',
          });
          hasLiked = true;
        }
        return { hasLiked, countLikes: await tx.postLike.count({ where: { postId: post.id } }) };
      });
      const body = asBodyObject(request.body);
      const returnTo = localReturnTo(body?.returnTo);
      if (returnTo) return reply.redirect(returnTo, 303);
      return {
        status: 'done',
        countLikes: result.countLikes,
        hasLiked: result.hasLiked,
      };
    });

    routes.get<{ Params: { url: string } }>('/v1/posts/:url/comments', async (request) => {
      const user = await activeUser(request, db, options);
      return done(await publicComments(db, request.params.url, user?.id ?? null));
    });

    routes.post('/v1/comments', { bodyLimit: commentBodyLimit }, async (request, reply) => {
      if (!requestCsrfAccepted(request, options)) return forbidden(reply);
      const body = asBodyObject(request.body);
      const slug = typeof request.query === 'object' && request.query !== null
        ? textValue((request.query as Record<string, unknown>).url)
        : '';
      const post = await publicPost(db, slug);
      if (!post) return missing(reply);

      const user = await activeUser(request, db, options);
      if (!user) return error('AT', 'Log in to continue.');
      if (isTrue(post.blockComment)) return error('RJ', 'Comments are disabled for this post.');

      const parentIdText = bodyField(body, 'parentId');
      let parent: CommentRow | null = null;
      if (parentIdText) {
        if (!/^\d+$/.test(parentIdText) || Number(parentIdText) < 1) return missing(reply);
        parent = await commentForViewer(db, Number(parentIdText), user.id);
        if (!parent) return missing(reply);
        if (parent.postId !== post.id) return error('RJ', 'The parent comment does not belong to this post.');
        if (parent.authorId === null) return error('RJ', 'You cannot reply to a deleted comment.');
        if (parent.parentId !== null) return error('RJ', 'You cannot reply to a reply.');
      }

      const markdown = bodyField(body, 'commentMd');
      const html = commentHtml(markdown);
      const commentId = await db.$transaction(async (tx) => {
        const inserted = await tx.comment.create({
          data: { markdown, html, authorId: user.id, postId: post.id, parentId: parent?.id ?? null },
          select: { id: true },
        });
        const recipientId = parent?.authorId ?? post.authorId;
        const data = { actor: user.username, url: publicPostPath(post.authorUsername, post.slug), title: post.title, commentId: inserted.id };
        await createNotification(tx, { ...data, recipientId, key: parent ? 'comment.replied' : 'post.commented', preference: 'NOTIFY_POSTS_COMMENT' });
        const mentions = [...new Set([...markdown.matchAll(/(?<![\p{L}\p{N}_@.+\-`*~])@([a-z0-9]{4,15})(?![\p{L}\p{N}_+\-`*~]|\.[a-zA-Z0-9])/gu)].map((match) => match[1]))];
        if (mentions.length) {
          const targets = await tx.user.findMany({
            where: { username: { in: mentions }, comments: { some: { postId: post.id } } },
            select: { id: true },
          });
          for (const target of targets) await createNotification(tx, {
            ...data, recipientId: target.id, key: 'comment.mentioned', preference: 'NOTIFY_MENTION',
          });
        }
        return inserted.id;
      });
      const created = await commentForViewer(db, commentId, user.id);
      if (!created) return reply.code(500).send({ error: 'Could not complete the request' });
      const returnTo = commentReturnTo(body?.returnTo, created.id);
      if (returnTo) return reply.redirect(returnTo, 303);
      return done(serializeComment(created, user.id, !isTrue(post.blockComment)));
    });

    routes.route<{ Params: { id: string } }>({
      method: ['GET', 'POST', 'PUT', 'DELETE'],
      url: '/v1/comments/:id',
      bodyLimit: commentBodyLimit,
      handler: async (request, reply) => {
        const id = Number(request.params.id);
        if (!Number.isSafeInteger(id) || id < 1) return missing(reply);
        if (request.method !== 'GET' && !requestCsrfAccepted(request, options)) return forbidden(reply);

        const viewer = await activeUser(request, db, options);
        const comment = await commentForViewer(db, id, viewer?.id ?? null);
        if (!comment) return missing(reply);
        if (!comment.postPublic) return missing(reply);

        if (request.method === 'GET') {
          if (comment.authorId === null) return missing(reply);
          if (!viewer || comment.authorId !== viewer.id) {
            return error('AT', 'You do not have permission to edit this comment.');
          }
          reply.header('Cache-Control', 'private, no-store');
          return done({ textMd: comment.markdown });
        }

        if (request.method === 'PUT' || request.method === 'POST') {
          const body = asBodyObject(request.body);
          if (truthyBodyField(body, 'like')) {
            if (!viewer) return error('NL', 'Log in to continue.');
            if (comment.authorId === viewer.id) return error('AT', 'You cannot like your own comment.');
            if (comment.authorId === null) return error('RJ', 'This comment has been deleted.');
            const recipientId = comment.authorId;

            const result = await db.$transaction(async (tx) => {
              const like = { commentId: comment.id, userId: viewer.id };
              const removed = await tx.commentLike.deleteMany({ where: like });
              const isLiked = removed.count === 0;
              if (isLiked) {
                const added = await createUnlessPresent(() => tx.commentLike.create({ data: like }));
                if (added) await createNotification(tx, {
                  recipientId, actor: viewer.username, url: publicPostPath(comment.postUsername, comment.postSlug), title: comment.postTitle,
                  commentId: comment.id, key: 'comment.liked', preference: 'NOTIFY_COMMENT_LIKE',
                });
              }
              return { isLiked, countLikes: await tx.commentLike.count({ where: { commentId: comment.id } }) };
            });
            const returnTo = localReturnTo(body?.returnTo);
            if (request.method === 'POST' && returnTo) return reply.redirect(returnTo, 303);
            return done({ isLiked: result.isLiked, countLikes: result.countLikes });
          }

          const formEdit = request.method === 'POST' && bodyField(body, 'action') === 'edit';
          if (formEdit || (request.method === 'PUT' && truthyBodyField(body, 'comment'))) {
            if (!viewer || comment.authorId !== viewer.id) {
              return error('AT', 'You do not have permission to edit this comment.');
            }
            const markdown = bodyField(body, 'commentMd');
            await db.comment.updateMany({
              where: { id: comment.id, authorId: viewer.id },
              data: { markdown, html: commentHtml(markdown), isEdited: true },
            });
            const returnTo = formEdit ? commentReturnTo(body?.returnTo, comment.id) : null;
            if (returnTo) return reply.redirect(returnTo, 303);
            return done();
          }

          if (request.method === 'POST' && bodyField(body, 'action') === 'delete') {
            if (!viewer || comment.authorId !== viewer.id) {
              return error('AT', 'You do not have permission to delete this comment.');
            }
            await anonymizeComments(db, viewer.id, comment.id);
            const returnTo = localReturnTo(body?.returnTo);
            if (returnTo) return reply.redirect(returnTo, 303);
            const deleted = await commentForViewer(db, comment.id, viewer.id);
            return done(deleted ? serializeComment(deleted, viewer.id, !deleted.postBlockComment) : {});
          }

          return missing(reply);
        }

        if (request.method === 'DELETE') {
          if (!viewer || comment.authorId !== viewer.id) {
            return error('AT', 'You do not have permission to delete this comment.');
          }
          await anonymizeComments(db, viewer.id, comment.id);
          const deleted = await commentForViewer(db, comment.id, viewer.id);
          return done(deleted ? serializeComment(deleted, viewer.id, !deleted.postBlockComment) : {});
        }

        return missing(reply);
      },
    });

    routes.route<{ Params: { username: string } }>({
      method: ['GET', 'POST', 'DELETE'],
      url: '/v1/users/@:username/subscription',
      handler: async (request, reply) => {
        if (request.method !== 'GET' && !requestCsrfAccepted(request, options)) return forbidden(reply);
        const author = await activeEditor(db, request.params.username);
        if (!author) return missing(reply);
        const viewer = await activeUser(request, db, options);
        const body = asBodyObject(request.body);
        const wantsUnsubscribe = request.method === 'DELETE' || (
          request.method === 'POST' && bodyField(body, 'action') === 'unsubscribe'
        );
        const returnTo = localReturnTo(body?.returnTo);

        if (request.method === 'GET') {
          return done(await subscriptionState(db, viewer, author));
        }
        if (!viewer) return error('NL', 'Log in to continue.');

        if (request.method === 'POST' && !wantsUnsubscribe) {
          if (viewer.id === author.id) return error('RJ', 'You cannot subscribe to yourself.');
          if (!canSubscribe(author)) return error('RJ', 'This user does not publish posts.');
          await db.$transaction(async (tx) => {
            const relation = { authorId: author.id, subscriberId: viewer.id };
            if (await createUnlessPresent(() => tx.authorSubscription.create({ data: relation }))) {
              await tx.authorSubscriptionLog.create({ data: { ...relation, action: 'subscribe' } });
            }
          });
          const setting = await db.integrationSetting.findUnique({
            where: { id: 1 },
            select: { telegramEnabled: true, telegramBotUsername: true, telegramBotToken: true },
          });
          const telegram = await db.telegramConnection.findUnique({ where: { userId: viewer.id }, select: { telegramId: true } });
          const suggestTelegramConnection = Boolean(setting?.telegramEnabled &&
            setting.telegramBotUsername.trim() !== '' &&
            Boolean(options.cipherKey && decryptDjangoSecret(setting.telegramBotToken, options.cipherKey)) &&
            !telegram?.telegramId.trim());
          const result = {
            canSubscribe: true,
            isSubscribed: true,
            suggestTelegramConnection,
          };
          if (returnTo) return reply.redirect(returnTo, 303);
          return done(result);
        }

        const canSubscribeAfterDelete = canSubscribe(author) && viewer.id !== author.id;
        await db.$transaction(async (tx) => {
          const relation = { authorId: author.id, subscriberId: viewer.id };
          const deleted = await tx.authorSubscription.deleteMany({ where: relation });
          if (deleted.count > 0) await tx.authorSubscriptionLog.create({ data: { ...relation, action: 'unsubscribe' } });
        });
        if (returnTo) return reply.redirect(returnTo, 303);
        return done({ canSubscribe: canSubscribeAfterDelete, isSubscribed: false });
      },
    });

    routes.get('/v1/subscriptions', async (request) => {
      const viewer = await activeUser(request, db, options);
      if (!viewer) return error('NL', 'Log in to continue.');
      return done(await mySubscriptions(db, viewer.id));
    });
  });
}
