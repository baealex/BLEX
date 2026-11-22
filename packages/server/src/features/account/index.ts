import formBody from '@fastify/formbody';
import multipart from '@fastify/multipart';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { updateAccountIdentity } from '../auth/account-identity.js';
import { renderAccountSettings, renderProfileSettings, renderSocialLinkSettings } from './pages.js';
import { done as success, failure } from '../../platform/response.js';
import { accountApiBody, accountExtras, readAccount, readAuthorAbout, readProfile, saveAuthorAbout, updateDisplayName, updateProfile, uploadedMediaUrl } from './services/profile.js';
import { MAX_PROFILE_IMAGE_BYTES, ProfileImageKind, deleteProfileCover, saveProfileImage } from './services/profile-images.js';
import { updateRegionalPreferences } from './services/regional.js';
import { applySocialMutation } from './services/social-links.js';
import { PersonalSettingsOptions, UpdateResult, apiValidationError, authenticatedDatabaseUser, bodyRecord, csrfToken, currentUser, formValue, html, loginRedirect, needLogin, pageUser, savedQuery, stringValue } from './shared.js';

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

    const sendAccountPage = async (request: FastifyRequest, reply: FastifyReply, error?: string) => {
      const user = await pageUser(request, reply, options);
      if (!user) return reply;
      const account = await readAccount(db, user.id);
      if (!account) return reply.code(404).send('계정 정보를 찾을 수 없습니다.');
      return html(reply, renderAccountSettings({ user, account, csrfToken: csrfToken(request), saved: error ? false : savedQuery(request), error }));
    };
    const sendProfilePage = async (request: FastifyRequest, reply: FastifyReply, error?: string) => {
      const user = await pageUser(request, reply, options);
      if (!user) return reply;
      const profile = await readProfile(db, user.id, options.siteUrl);
      if (!profile) return reply.code(404).send('프로필 정보를 찾을 수 없습니다.');
      return html(reply, renderProfileSettings({ user, profile, csrfToken: csrfToken(request), saved: error ? false : savedQuery(request), error }));
    };
    const sendSocialPage = async (request: FastifyRequest, reply: FastifyReply, error?: string) => {
      const user = await pageUser(request, reply, options);
      if (!user) return reply;
      const profile = await readProfile(db, user.id, options.siteUrl);
      if (!profile) return reply.code(404).send('프로필 정보를 찾을 수 없습니다.');
      return html(reply, renderSocialLinkSettings({ user, profile, csrfToken: csrfToken(request), saved: error ? false : savedQuery(request), error }));
    };

    const registerProfileImageUpload = (kind: ProfileImageKind) => {
      const expectedReturnTo = `/settings/profile?saved=${kind}`;
      routes.post<{ Body: unknown }>(`/v1/setting/${kind}`, { bodyLimit: MAX_PROFILE_IMAGE_BYTES + 32 * 1024 }, async (request, reply) => {
        const isHtmlForm = formValue(request, 'return_to') === expectedReturnTo;
        const user = await authenticatedDatabaseUser(db, request, options);
        if (!user) return isHtmlForm ? loginRedirect(request, reply) : needLogin();
        if (!options.validateCsrf(request)) {
          if (isHtmlForm) return reply.code(403).send('요청을 확인해 주세요.');
          return reply.code(403).send(failure('RJ'));
        }
        const upload = bodyRecord(request.body)[kind];
        if (!Buffer.isBuffer(upload)) {
          if (isHtmlForm) return reply.code(400).type('text/html; charset=utf-8').send(await sendProfileError(request, reply, '유효한 프로필 이미지를 업로드해 주세요.'));
          return reply.send(failure('VA', 'Upload a valid profile image.'));
        }
        if (!options.mediaRoot) {
          if (isHtmlForm) return reply.code(503).type('text/html; charset=utf-8').send(await sendProfileError(request, reply, '프로필 이미지 저장소를 사용할 수 없습니다.'));
          return reply.code(503).send(failure('RJ', 'Profile image storage is unavailable.'));
        }
        const url = await saveProfileImage(db, user, kind, upload, options.mediaRoot, options.siteUrl);
        if (!url) {
          if (isHtmlForm) return reply.code(400).type('text/html; charset=utf-8').send(await sendProfileError(request, reply, '유효한 프로필 이미지를 업로드해 주세요.'));
          return reply.send(failure('VA', 'Upload a valid profile image.'));
        }
        if (isHtmlForm) return reply.redirect(expectedReturnTo, 303);
        return success({ url: uploadedMediaUrl(url) });
      });
    };

    registerProfileImageUpload('avatar');
    registerProfileImageUpload('cover');

    routes.get('/settings', (_request, reply) => reply.redirect('/settings/notify', 302));
    routes.get('/settings/', (_request, reply) => reply.redirect('/settings/notify', 302));
    routes.get('/settings/account', (request, reply) => sendAccountPage(request, reply));
    routes.get('/settings/profile', (request, reply) => sendProfilePage(request, reply));
    routes.get('/settings/social-links', (request, reply) => sendSocialPage(request, reply));

    routes.post<{ Params: { username: string }; Body: unknown }>(
      '/@:username/about/edit', async (request, reply) => {
        const user = await authenticatedDatabaseUser(db, request, options);
        if (!user) {
          loginRedirect(request, reply);
          return reply;
        }
        if (!options.validateCsrf(request)) return reply.code(403).send('요청을 확인해 주세요.');
        const author = await readAuthorAbout(db, request.params.username);
        if (!author) return reply.code(404).send('작가 정보를 찾을 수 없습니다.');
        if (author.id !== user.id) return reply.code(403).send('접근 권한이 없습니다.');
        const saved = await saveAuthorAbout(db, user.id, bodyRecord(request.body).about_md);
        if (!saved) return reply.code(400).send({ status: 'error', message: '소개글을 저장하지 못했습니다.' });
        return reply.send({ status: 'success', message: '소개글을 저장했습니다.', about_md: saved.markdown, about_html: saved.html });
      },
    );

    routes.put<{ Params: { username: string }; Body: unknown }>(
      '/v1/users/@:username', async (request, reply) => {
        const user = await authenticatedDatabaseUser(db, request, options);
        if (!user) return needLogin();
        const body = bodyRecord(request.body);
        const aboutFlag = body.about === true || Boolean(stringValue(body.about));
        if (!aboutFlag) return reply.code(404).send('Not found');
        const author = await readAuthorAbout(db, request.params.username);
        if (!author) return reply.code(404).send('Not found');
        if (author.id !== user.id) return reply.send(failure('AT'));
        if (!options.validateCsrf(request)) return reply.code(403).send(failure('RJ'));
        const saved = await saveAuthorAbout(db, user.id, body.about_md);
        if (!saved) return reply.send(failure('VA', '소개 내용을 확인해 주세요.'));
        return success();
      },
    );

    routes.delete('/v1/setting/cover', async (request, reply) => {
      const user = await authenticatedDatabaseUser(db, request, options);
      if (!user) return needLogin();
      if (!options.validateCsrf(request)) return reply.code(403).send(failure('RJ'));
      if (!options.mediaRoot) return reply.code(503).send(failure('RJ', 'Profile image storage is unavailable.'));
      await deleteProfileCover(db, user, options.mediaRoot);
      return success({ url: null });
    });

    routes.post('/settings/profile/cover/delete', async (request, reply) => {
      const user = await authenticatedDatabaseUser(db, request, options);
      if (!user) {
        loginRedirect(request, reply);
        return reply;
      }
      if (!options.validateCsrf(request)) return reply.code(403).send('요청을 확인해 주세요.');
      if (!options.mediaRoot) return reply.code(503).type('text/html; charset=utf-8').send(await sendProfileError(request, reply, '프로필 이미지 저장소를 사용할 수 없습니다.'));
      await deleteProfileCover(db, user, options.mediaRoot);
      return reply.redirect('/settings/profile?saved=cover', 303);
    });

    routes.post('/settings/account', async (request, reply) => {
      const user = await pageUser(request, reply, options);
      if (!user) return reply;
      if (!options.validateCsrf(request)) return reply.code(403).send('요청을 확인해 주세요.');
      const body = bodyRecord(request.body);
      let result: UpdateResult;
      if (body.intent === 'name') {
        result = await updateDisplayName(db, user.id, body.name);
      } else if (body.intent === 'username') {
        const error = await updateAccountIdentity(db, user.id, body, 'account');
        result = error ? { ok: false, message: error } : { ok: true };
      } else if (body.intent === 'regional') {
        const language = body.language === 'browser' ? null : body.language;
        result = await updateRegionalPreferences(db, user.id, { language, time_zone: body.time_zone });
      } else {
        result = { ok: false, message: '요청을 확인해 주세요.' };
      }
      if (!result.ok) return reply.code(400).type('text/html; charset=utf-8').send(await sendAccountError(request, reply, result.message));
      return reply.redirect('/settings/account?saved=1', 303);
    });

    routes.post('/settings/profile', async (request, reply) => {
      const user = await pageUser(request, reply, options);
      if (!user) return reply;
      if (!options.validateCsrf(request)) return reply.code(403).send('요청을 확인해 주세요.');
      const result = await updateProfile(db, user.id, bodyRecord(request.body));
      if (!result.ok) return reply.code(400).type('text/html; charset=utf-8').send(await sendProfileError(request, reply, result.message));
      return reply.redirect('/settings/profile?saved=1', 303);
    });

    routes.post('/settings/social-links', async (request, reply) => {
      const user = await pageUser(request, reply, options);
      if (!user) return reply;
      if (!options.validateCsrf(request)) return reply.code(403).send('요청을 확인해 주세요.');
      const result = await applySocialMutation(db, user.id, bodyRecord(request.body), 'form');
      if (!result.ok) return reply.code(400).type('text/html; charset=utf-8').send(await sendSocialError(request, reply, result.message));
      return reply.redirect('/settings/social-links?saved=1', 303);
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
      if (password !== undefined && typeof password !== 'string') return reply.send(failure('VA', '비밀번호를 확인해 주세요.'));
      if (typeof password === 'string' && password) {
        if (!options.updatePassword) return reply.send(failure('VA', '비밀번호 변경 기능을 사용할 수 없습니다.'));
        return options.updatePassword(request, reply, user, body);
      }
      if (body.username) {
        const error = await updateAccountIdentity(db, user.id, body, 'account');
        return error ? failure('VA', error) : success();
      }
      const result = body.name === undefined ? { ok: true } as const : await updateDisplayName(db, user.id, body.name);
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

  async function sendAccountError(request: FastifyRequest, reply: FastifyReply, message: string): Promise<string> {
    const user = await options.currentUser(request);
    if (!user) return 'Not found';
    const account = await readAccount(db, user.id);
    return account ? renderAccountSettings({ user, account, csrfToken: csrfToken(request), error: message }) : 'Not found';
  }

  async function sendProfileError(request: FastifyRequest, reply: FastifyReply, message: string): Promise<string> {
    const user = await options.currentUser(request);
    if (!user) return 'Not found';
    const profile = await readProfile(db, user.id, options.siteUrl);
    return profile ? renderProfileSettings({ user, profile, csrfToken: csrfToken(request), error: message }) : 'Not found';
  }

  async function sendSocialError(request: FastifyRequest, reply: FastifyReply, message: string): Promise<string> {
    const user = await options.currentUser(request);
    if (!user) return 'Not found';
    const profile = await readProfile(db, user.id, options.siteUrl);
    return profile ? renderSocialLinkSettings({ user, profile, csrfToken: csrfToken(request), error: message }) : 'Not found';
  }
}
