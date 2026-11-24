import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test, { type TestContext } from 'node:test';
import { PrismaClient } from '@prisma/client';
import type { FastifyRequest } from 'fastify';
import { buildApp } from '../src/app.js';
import { signupRegion } from '../src/features/auth/account-validation.js';
import { encryptSecret } from '../src/features/auth/encrypted-secret.js';
import { deliverTelegramNotification } from '../src/features/notifications/delivery.js';
import { defaultUiLocale, resolveUiLocale } from '../src/platform/locale.js';
import {
  createMigratedDatabase,
  insertRow,
  seedEditor,
  signIn,
  testCipherKey,
  testSecretKey,
  testSiteUrl,
} from './fixtures/migrated-database.js';

function configureLanguages(t: TestContext) {
  for (const key of ['ENABLE_ENGLISH_UI', 'DEBUG', 'BLEX_DEFAULT_LANGUAGE']) {
    const original = process.env[key];
    t.after(() => {
      if (original === undefined) delete process.env[key];
      else process.env[key] = original;
    });
  }
  process.env.ENABLE_ENGLISH_UI = 'TRUE';
  process.env.DEBUG = 'FALSE';
  process.env.BLEX_DEFAULT_LANGUAGE = 'en';
}

test('uses a supported user language before the site default and safely handles unavailable defaults', (t) => {
  configureLanguages(t);
  assert.equal(resolveUiLocale('ko'), 'ko');
  assert.equal(resolveUiLocale(' EN_us '), 'en');
  for (const language of [null, undefined, '', 'fr']) assert.equal(resolveUiLocale(language), 'en');

  process.env.BLEX_DEFAULT_LANGUAGE = 'fr';
  assert.equal(defaultUiLocale(), 'ko');
  assert.equal(resolveUiLocale('en'), 'en');
  delete process.env.BLEX_DEFAULT_LANGUAGE;
  assert.equal(defaultUiLocale(), 'ko');

  process.env.BLEX_DEFAULT_LANGUAGE = 'en';
  process.env.ENABLE_ENGLISH_UI = 'FALSE';
  assert.equal(resolveUiLocale('en'), 'ko');
  assert.equal(defaultUiLocale(), 'ko');
  process.env.DEBUG = 'TRUE';
  assert.equal(resolveUiLocale('en'), 'en');
  assert.equal(defaultUiLocale(), 'en');
});

test('new accounts inherit the site default unless a supported language was explicitly chosen', (t) => {
  configureLanguages(t);
  const request = { cookies: {}, headers: { 'accept-language': 'ko-KR' } } as FastifyRequest;
  assert.deepEqual(signupRegion(request, 'Asia/Seoul'), { language: '', timeZone: 'Asia/Seoul' });
  request.cookies.django_language = 'ko-KR';
  assert.equal(signupRegion(request, '').language, 'ko');
  request.cookies.django_language = 'en-US';
  assert.equal(signupRegion(request, '').language, 'en');
  request.cookies.django_language = 'fr';
  assert.equal(signupRegion(request, '').language, '');
});

test('keeps web screens, API messages, notifications, and Telegram on the same language priority', async (t) => {
  configureLanguages(t);
  const fixture = await createMigratedDatabase();
  const db = new PrismaClient({ datasourceUrl: `file:${fixture.path}?connection_limit=1` });
  seedEditor(fixture.db, 1, 'writer');
  insertRow(fixture.db, 'IntegrationSetting', {
    id: 1,
    telegramEnabled: 1,
    telegramBotUsername: 'locale_bot',
    telegramBotToken: encryptSecret('123:locale-test', testCipherKey),
  });
  insertRow(fixture.db, 'TelegramConnection', {
    userId: 1,
    telegramId: encryptSecret('456', testCipherKey),
  });
  insertRow(fixture.db, 'Notification', {
    id: 1,
    userId: 1,
    key: 'locale-test',
    url: '/@author/original',
    messageKey: 'post.published',
    messageParams: JSON.stringify({ actor: 'author', post_title: 'Original 사용자 글' }),
  });
  const token = 'blex_pat_localetest000_locale-test';
  insertRow(fixture.db, 'DeveloperToken', {
    id: 1,
    userId: 1,
    tokenPrefix: 'localetest000',
    tokenHash: createHash('sha256').update(token).digest('hex'),
    scopes: JSON.stringify(['posts:read']),
  });
  const app = await buildApp(
    fixture.path,
    testSiteUrl,
    {
      secretKey: testSecretKey,
      cipherKey: testCipherKey,
    },
    fixture.mediaRoot,
  );
  t.after(async () => {
    await app.close();
    await db.$disconnect();
    await fixture.cleanup();
  });
  const headers = signIn(fixture.db, 1);

  for (const scenario of [
    { user: 'ko', system: 'en', expected: 'ko' },
    { user: 'en', system: 'ko', expected: 'en' },
    { user: 'EN_us', system: 'ko', expected: 'en' },
    { user: null, system: 'en', expected: 'en' },
    { user: '', system: 'en', expected: 'en' },
    { user: 'fr', system: 'en', expected: 'en' },
    { user: undefined, system: 'en', expected: 'en' },
    { user: 'en', system: 'en', expected: 'ko', disabled: true },
    { user: 'en', system: 'en', expected: 'en', disabled: true, debug: true },
  ]) {
    await t.test(
      `user=${scenario.user}, site=${scenario.system}, disabled=${Boolean(scenario.disabled)}, debug=${Boolean(scenario.debug)}`,
      async () => {
        process.env.BLEX_DEFAULT_LANGUAGE = scenario.system;
        process.env.ENABLE_ENGLISH_UI = scenario.disabled ? 'FALSE' : 'TRUE';
        process.env.DEBUG = scenario.debug ? 'TRUE' : 'FALSE';
        if (scenario.user === undefined) await db.userPreference.deleteMany({ where: { userId: 1 } });
        else
          await db.userPreference.upsert({
            where: { userId: 1 },
            create: { userId: 1, language: scenario.user },
            update: { language: scenario.user },
          });
        const browser = scenario.expected === 'ko' ? 'en-US' : 'ko-KR';
        const requestHeaders = { ...headers, 'accept-language': browser };
        const screen = await app.inject({ url: '/settings/account', headers: requestHeaders });
        assert.equal(screen.statusCode, 200, screen.body);
        assert.equal(screen.headers['content-language'], scenario.expected);
        assert.match(screen.body, new RegExp(`<html lang="${scenario.expected}"`));

        const missingSeries = await app.inject({ url: '/v1/series/999', headers: requestHeaders });
        assert.equal(
          missingSeries.json().errorMessage,
          scenario.expected === 'en' ? 'Series not found.' : '시리즈를 찾을 수 없습니다.',
        );
        const account = await app.inject({ url: '/v1/setting/account', headers: requestHeaders });
        if (scenario.user === 'EN_us') assert.equal(account.json().body.regionalPreferences.language, 'en');
        assert.equal(
          account.json().body.regionalPreferences.defaultLanguage,
          scenario.disabled && !scenario.debug ? 'ko' : scenario.system,
        );

        const inbox = await app.inject({ url: '/v1/setting/notify', headers: requestHeaders });
        const expectedText =
          scenario.expected === 'en'
            ? '@author published a new post: "Original 사용자 글".'
            : '@author님이 새 글을 발행했습니다: "Original 사용자 글"';
        assert.equal(inbox.json().body.notify[0].content, expectedText);
        await db.notificationDelivery.create({ data: { notificationId: 1, availableAt: new Date(0) } });
        let sentText = '';
        await deliverTelegramNotification(
          db,
          testSiteUrl,
          testCipherKey,
          async (_url, init) => {
            sentText = JSON.parse(String(init?.body)).text;
            return Response.json({ ok: true });
          },
          new AbortController().signal,
        );
        assert.equal(sentText, `${new URL('/@author/original', testSiteUrl).href}\n${expectedText}`);

        const missingPost = await app.inject({
          url: '/api/developer/v1/posts/999',
          headers: { authorization: `Bearer ${token}`, 'accept-language': browser },
        });
        assert.equal(missingPost.statusCode, 404, missingPost.body);
        assert.equal(
          missingPost.json().error.message,
          scenario.expected === 'en' ? 'Post not found.' : '포스트를 찾을 수 없습니다.',
        );
      },
    );
  }

  process.env.BLEX_DEFAULT_LANGUAGE = 'en';
  process.env.ENABLE_ENGLISH_UI = 'TRUE';
  const anonymous = await app.inject({ url: '/search', headers: { 'accept-language': 'ko-KR' } });
  assert.equal(anonymous.headers['content-language'], 'en');
  assert.match(anonymous.body, /<html lang="en"/);
});
