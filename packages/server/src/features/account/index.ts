import { systemMessage } from '../../platform/messages.js';
import formBody from '@fastify/formbody';
import multipart from '@fastify/multipart';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { updateAccountIdentity } from '../auth/account-identity.js';
import { done as success, failure } from '../../platform/response.js';
import {
  accountApiBody,
  accountExtras,
  readAccount,
  readAuthorAbout,
  readProfile,
  saveAuthorAbout,
  updateDisplayName,
  updateProfile,
  uploadedMediaUrl,
} from './services/profile.js';
import {
  MAX_PROFILE_IMAGE_BYTES,
  type ProfileImageKind,
  deleteProfileCover,
  saveProfileImage,
} from './services/profile-images.js';
import { updateRegionalPreferences } from './services/regional.js';
import { applySocialMutation } from './services/social-links.js';
import {
  type PersonalSettingsOptions,
  apiValidationError,
  authenticatedDatabaseUser,
  bodyRecord,
  currentUser,
  loginRedirect,
  needLogin,
  stringValue,
} from './shared.js';

export { PersonalSettingsOptions } from './shared.js';

export function registerPersonalSettings(app: FastifyInstance, db: PrismaClient, options: PersonalSettingsOptions) {
  app.register(async (routes) => {
    await routes.register(formBody);
    await routes.register(multipart, {
      attachFieldsToBody: 'keyValues',
      limits: { files: 1, fields: 8, parts: 10, fieldSize: 2048, fileSize: MAX_PROFILE_IMAGE_BYTES },
    });
    routes.addHook('onRequest', async (_request, reply) => {
      reply.header('Cache-Control', 'private, no-store');
    });

    const registerProfileImageUpload = (kind: ProfileImageKind) => {
      routes.post<{ Body: unknown }>(
        `/v1/setting/${kind}`,
        { bodyLimit: MAX_PROFILE_IMAGE_BYTES + 32 * 1024 },
        async (request, reply) => {
          const user = await authenticatedDatabaseUser(db, request, options);
          if (!user) return needLogin();
          if (!options.validateCsrf(request)) return reply.code(403).send(failure('RJ'));
          const upload = bodyRecord(request.body)[kind];
          if (!Buffer.isBuffer(upload)) return reply.send(failure('VA', 'Upload a valid profile image.'));
          if (!options.mediaRoot) return reply.code(503).send(failure('RJ', 'Profile image storage is unavailable.'));
          const url = await saveProfileImage(db, user, kind, upload, options.mediaRoot, options.siteUrl);
          if (!url) return reply.send(failure('VA', 'Upload a valid profile image.'));
          return success({ url: uploadedMediaUrl(url) });
        },
      );
    };

    registerProfileImageUpload('avatar');
    registerProfileImageUpload('cover');

    routes.post<{ Params: { username: string }; Body: unknown }>('/@:username/about/edit', async (request, reply) => {
      const user = await authenticatedDatabaseUser(db, request, options);
      if (!user) {
        loginRedirect(request, reply);
        return reply;
      }
      if (!options.validateCsrf(request)) return reply.code(403).send(systemMessage('Check your request.'));
      const author = await readAuthorAbout(db, request.params.username);
      if (!author) return reply.code(404).send(systemMessage('Author not found.'));
      if (author.id !== user.id) return reply.code(403).send(systemMessage('Access denied.'));
      const saved = await saveAuthorAbout(db, user.id, bodyRecord(request.body).aboutMarkdown);
      if (!saved)
        return reply.code(400).send({ status: 'error', message: systemMessage('Could not save your introduction.') });
      return reply.send({
        status: 'success',
        message: systemMessage('Introduction saved.'),
        aboutMarkdown: saved.markdown,
        aboutHtml: saved.html,
      });
    });

    routes.put<{ Params: { username: string }; Body: unknown }>('/v1/users/@:username', async (request, reply) => {
      const user = await authenticatedDatabaseUser(db, request, options);
      if (!user) return needLogin();
      const body = bodyRecord(request.body);
      const aboutFlag = body.about === true || Boolean(stringValue(body.about));
      if (!aboutFlag) return reply.code(404).send('Not found');
      const author = await readAuthorAbout(db, request.params.username);
      if (!author) return reply.code(404).send('Not found');
      if (author.id !== user.id) return reply.send(failure('AT'));
      if (!options.validateCsrf(request)) return reply.code(403).send(failure('RJ'));
      const saved = await saveAuthorAbout(db, user.id, body.aboutMarkdown);
      if (!saved) return reply.send(failure('VA', systemMessage('Check your introduction.')));
      return success();
    });

    routes.delete('/v1/setting/cover', async (request, reply) => {
      const user = await authenticatedDatabaseUser(db, request, options);
      if (!user) return needLogin();
      if (!options.validateCsrf(request)) return reply.code(403).send(failure('RJ'));
      if (!options.mediaRoot) return reply.code(503).send(failure('RJ', 'Profile image storage is unavailable.'));
      await deleteProfileCover(db, user, options.mediaRoot);
      return success({ url: null });
    });

    routes.get('/v1/setting/account', async (request, reply) => {
      const user = await currentUser(request, reply, options);
      if (!user) return needLogin();
      const account = await readAccount(db, user.id);
      if (!account) return reply.code(404).send('Not found');
      const extras = await accountExtras(db, user.id);
      return success(accountApiBody(account, extras));
    });

    routes.put('/v1/setting/account', async (request, reply) => {
      const user = await currentUser(request, reply, options);
      if (!user) return needLogin();
      if (!options.validateCsrf(request)) return reply.code(403).send(failure('RJ'));
      const body = bodyRecord(request.body);
      const password = body.password;
      if (password !== undefined && typeof password !== 'string')
        return reply.send(failure('VA', systemMessage('Check your password.')));
      if (typeof password === 'string' && password) {
        if (!options.updatePassword)
          return reply.send(failure('VA', systemMessage('Password changes are unavailable.')));
        return options.updatePassword(request, reply, user, body);
      }
      if (body.username) {
        const error = await updateAccountIdentity(db, user.id, body, 'account');
        return error ? failure('VA', error) : success();
      }
      const result =
        body.name === undefined ? ({ ok: true } as const) : await updateDisplayName(db, user.id, body.name);
      if (!result.ok) return apiValidationError(reply, result);
      return success();
    });

    routes.put('/v1/setting/regional-preferences', async (request, reply) => {
      const user = await currentUser(request, reply, options);
      if (!user) return needLogin();
      if (!options.validateCsrf(request)) return reply.code(403).send(failure('RJ'));
      const result = await updateRegionalPreferences(db, user.id, bodyRecord(request.body));
      if (!result.ok) return apiValidationError(reply, result);
      return success();
    });

    routes.get('/v1/setting/profile', async (request, reply) => {
      const user = await currentUser(request, reply, options);
      if (!user) return needLogin();
      const profile = await readProfile(db, user.id, options.siteUrl);
      return profile ? success(profile) : reply.code(404).send('Not found');
    });

    routes.put('/v1/setting/profile', async (request, reply) => {
      const user = await currentUser(request, reply, options);
      if (!user) return needLogin();
      if (!options.validateCsrf(request)) return reply.code(403).send(failure('RJ'));
      const result = await updateProfile(db, user.id, bodyRecord(request.body));
      if (!result.ok) return apiValidationError(reply, result);
      return success();
    });

    routes.put('/v1/setting/social', async (request, reply) => {
      const user = await currentUser(request, reply, options);
      if (!user) return needLogin();
      if (!options.validateCsrf(request)) return reply.code(403).send(failure('RJ'));
      const result = await applySocialMutation(db, user.id, bodyRecord(request.body), 'legacy');
      if (!result.ok) return apiValidationError(reply, result);
      const profile = await readProfile(db, user.id, options.siteUrl);
      return success(profile?.social ?? []);
    });
  });
}
