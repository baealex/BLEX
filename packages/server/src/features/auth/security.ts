import { systemMessage } from '../../platform/messages.js';
import { renderPage } from '../../platform/views.js';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { prepareUsernameChange } from './account-identity.js';
import { accountUsernamePattern, describeInvalidPassword } from './account-validation.js';
import { authCookieOptions, csrfCookie, sessionCookie, setSessionCookies } from '../../platform/cookies.js';
import { csrfPattern, formInput, validCsrf } from '../../platform/csrf.js';
import { deleteAccount } from './delete-account.js';
import { hashPassword, verifyPassword } from './password-hash.js';
import { activateFactor, beginFactorSetup, disableFactor } from './factor-management.js';
import type { AuthConfig } from './http.js';
import { reserveLoginAttempt } from './login-attempts.js';
import { publicOAuthProviders, safeReturnPath } from './oauth.js';
import { credentialTag, createToken, tokenHash } from './session.js';
import { recoveredAccountPath } from './recovery-path.js';
import { isRecoveryCode, verifySecondFactor } from './two-factor.js';
import { acquireVerification, hasVerification, readVerificationAccount, recordVerification } from './verification.js';
import { readPublicSiteBrand } from '../discovery/http/pages.js';
import { done, failure } from '../../platform/response.js';

const success = done();

export function securityError(code: string, errorMessage = '') {
  return failure(code, errorMessage);
}

export const verificationRequired = {
  ...securityError('RE'),
  get errorMessage() {
    return systemMessage('Verify your identity to continue.');
  },
  messageKey: 'auth.reauthentication_required',
  messageParams: {},
};

export function reauthenticationPath(next: string) {
  return `/reauthenticate?${new URLSearchParams({ next })}`;
}

function factorError(code: string | null, action?: string) {
  if (!code) return success;
  if (code === 'RE') return verificationRequired;
  const messages: Record<string, string> = {
    AU: systemMessage('Two-factor authentication is already disabled.'),
    AC: systemMessage('Two-factor authentication is already enabled.'),
    EP: systemMessage('The two-factor setup session has expired. Try again.'),
    IP: systemMessage('Enter an authentication code.'),
    RJ:
      action === 'disable'
        ? systemMessage('Two-factor authentication cannot be disabled within 24 hours.')
        : systemMessage('Invalid authentication code.'),
  };
  return securityError(code, messages[code]);
}

async function readSecurityViewer(db: PrismaClient, accountId: number) {
  const viewer = await db.user.findUnique({
    where: { id: accountId },
    select: { isStaff: true, profile: { select: { role: true } } },
  });
  return (
    viewer && {
      role: viewer.profile?.role ?? null,
      isStaff: viewer.isStaff,
      unreadCount: await db.notification.count({ where: { userId: accountId, isRead: false } }),
    }
  );
}

export function csrfForPage(request: FastifyRequest, reply: FastifyReply, siteUrl: URL) {
  const previous = request.cookies[csrfCookie];
  if (previous && csrfPattern.test(previous)) return previous;
  const token = createToken();
  reply.setCookie(csrfCookie, token, authCookieOptions(siteUrl));
  return token;
}

export function submittedPasswordError(password: string, account: { username: string; name: string; email: string }) {
  if (
    !/\p{N}/u.test(password) ||
    !/\p{Ll}/u.test(password) ||
    !/\p{Lu}/u.test(password) ||
    !/[^\p{N}\p{Ll}\p{Lu}]/u.test(password)
  ) {
    return systemMessage(
      'Include a number, a lowercase letter, an uppercase letter, and a special character in your password.',
    );
  }
  return describeInvalidPassword(password, [account.username, account.name, account.email]);
}

type PasswordUpdate = typeof success | ReturnType<typeof securityError> | typeof verificationRequired;

export function passwordUpdater(db: PrismaClient, siteUrl: URL, config: AuthConfig) {
  return async (
    request: FastifyRequest,
    reply: FastifyReply,
    user: { id: number },
    input: Record<string, unknown>,
  ): Promise<PasswordUpdate> => {
    const account = await readVerificationAccount(db, request, config.secretKey);
    if (!account || user.id !== account.id) return securityError('NL');
    if (!validCsrf(request, siteUrl)) return reply.code(403).send(securityError('RJ'));
    if (!hasVerification(account)) return verificationRequired;
    const { password, username, name, revokeTokens } = input;
    if (
      typeof password !== 'string' ||
      !password ||
      (username !== undefined && typeof username !== 'string') ||
      (name !== undefined && typeof name !== 'string')
    )
      return securityError('VA');
    const newUsername = username || account.username;
    const newName = name || account.name;
    if ((newUsername !== account.username && !accountUsernamePattern.test(newUsername)) || newName.length > 150)
      return securityError('VA');
    const passwordError = submittedPasswordError(password, {
      username: newUsername,
      name: newName,
      email: account.email,
    });
    if (passwordError) return securityError('VA', passwordError);
    const newPasswordHash = await hashPassword(password);
    const sessionToken = createToken();
    const sessionHash = tokenHash(sessionToken);
    if (!sessionHash) throw new Error('Invalid generated session token.');
    const revokedAt = new Date();

    const result = await db.$transaction<PasswordUpdate>(async (tx) => {
      if (!(await acquireVerification(tx, account))) return verificationRequired;
      if (username) {
        const current = await tx.user.findUniqueOrThrow({ where: { id: account.id }, select: { username: true } });
        const invalid = await prepareUsernameChange(tx, account.id, current.username, newUsername, 'account');
        if (invalid) return securityError('VA', invalid);
      }
      await tx.user.update({
        where: { id: account.id },
        data: { passwordHash: newPasswordHash, username: username || undefined, name: name || undefined },
        select: { id: true },
      });
      await tx.session.deleteMany({ where: { userId: account.id, tokenHash: { not: account.sessionHash } } });
      await tx.factorSetup.deleteMany({ where: { sessionHash: account.sessionHash } });
      await tx.session.updateMany({
        where: { tokenHash: account.sessionHash },
        data: {
          tokenHash: sessionHash,
          credentialTag: credentialTag(newPasswordHash, config.secretKey),
          verifiedUntil: null,
          verifiedFactorId: null,
          requiresFactor: false,
        },
      });
      if (revokeTokens === true || revokeTokens === 'true') {
        await tx.developerToken.updateMany({
          where: { userId: account.id, revokedAt: null },
          data: { revokedAt, updatedAt: revokedAt },
        });
      }
      return success;
    });
    if (result.status === 'DONE') setSessionCookies(reply, siteUrl, sessionToken);
    return result;
  };
}

export function registerAccountSecurity(app: FastifyInstance, db: PrismaClient, siteUrl: URL, config: AuthConfig) {
  const reauthenticate = async (request: FastifyRequest<{ Querystring: { next?: string } }>, reply: FastifyReply) => {
    const next = safeReturnPath(request.query.next ?? '/settings/account', siteUrl);
    const account = await readVerificationAccount(db, request, config.secretKey);
    if (!account) return reply.redirect(`/login?${new URLSearchParams({ next: reauthenticationPath(next) })}`, 302);
    if (hasVerification(account)) return reply.redirect(next, 302);
    const pendingFactor = hasVerification(account, true);
    const hasPassword = /^[a-z0-9_]+\$/.test(account.passwordHash);
    let error = '';
    if (request.method === 'POST') {
      if (!validCsrf(request, siteUrl)) return reply.code(403).send(systemMessage('Check your request.'));
      const input = formInput(request);
      const attempt = await reserveLoginAttempt(db, config.secretKey, request.ip, account.username);
      if (!attempt) error = systemMessage('Too many failed attempts. Please try again later.');
      else {
        const isAccount =
          pendingFactor ||
          (hasPassword &&
            typeof input.password === 'string' &&
            (await verifyPassword(input.password, account.passwordHash)));
        const code = typeof input.code === 'string' ? input.code : '';
        const isFactor =
          account.factorId === null ||
          (account.totpSecret !== null &&
            account.recoveryKey !== null &&
            verifySecondFactor(
              { totpSecret: account.totpSecret, recoveryKey: account.recoveryKey },
              code,
              config.cipherKey,
            ));
        if (!isAccount || !isFactor) error = systemMessage('The password or authentication code is incorrect.');
        else {
          const spentRecoveryKey =
            account.factorId !== null && isRecoveryCode(code) ? (account.recoveryKey ?? undefined) : undefined;
          const token = await recordVerification(db, account, false, spentRecoveryKey);
          await attempt();
          if (token)
            return setSessionCookies(reply, siteUrl, token).redirect(
              spentRecoveryKey === undefined ? next : recoveredAccountPath,
              302,
            );
          return reply.redirect(reauthenticationPath(next), 302);
        }
      }
    }

    const csrf = csrfForPage(request, reply, siteUrl);
    const links = await db.socialAccount.findMany({
      where: { userId: account.id, provider: { isEnabled: true } },
      select: { provider: { select: { key: true } } },
    });
    const providers = (await publicOAuthProviders(db, config.cipherKey)).filter((choice) =>
      links.some((link) => link.provider.key === choice.key),
    );
    const showForm = hasPassword || pendingFactor;
    const visibleProviders = pendingFactor ? [] : providers;
    const viewer = await readSecurityViewer(db, account.id);
    const brand = await readPublicSiteBrand(db);
    const fieldClass = 'block h-12 w-full rounded-lg border border-line bg-surface px-3';
    return reply.type('text/html; charset=utf-8').header('Cache-Control', 'private, no-store').send(
      renderPage('reauthenticate', {
        brand,
        account,
        viewer,
        csrf,
        error,
        showForm,
        next,
        pendingFactor,
        fieldClass,
        visibleProviders,
      }),
    );
  };

  app.get('/reauthenticate', reauthenticate);
  app.post('/reauthenticate', reauthenticate);

  app.get('/v1/auth/security', async (request) => {
    const account = await readVerificationAccount(db, request, config.secretKey);
    if (!account) return securityError('NL');
    if (account.factorId === null) return securityError('NF');
    return { status: 'DONE', body: { isEnabled: true, hasRecoveryKey: Boolean(account.recoveryKey) } };
  });

  app.delete('/v1/sign', async (request, reply) => {
    const account = await readVerificationAccount(db, request, config.secretKey);
    if (!account || !hasVerification(account)) return account ? verificationRequired : securityError('NL');
    if (!validCsrf(request, siteUrl)) return reply.code(403).send(securityError('RJ'));
    const deleted = await deleteAccount(db, account, config.mediaRoot);
    if (deleted.error === 'RE') return verificationRequired;
    if (deleted.error === 'RJ')
      return securityError('RJ', systemMessage('The last administrator account cannot be deleted.'));
    reply.clearCookie(sessionCookie, authCookieOptions(siteUrl));
    return success;
  });

  const factorRoutes = [
    { url: '/v1/auth/security', method: 'POST', action: 'setup' },
    { url: '/v1/auth/security/verify', method: 'POST', action: 'activate' },
    { url: '/v1/auth/security', method: 'DELETE', action: 'disable' },
  ] as const;
  for (const { url, method, action } of factorRoutes) {
    app.route({
      method,
      url,
      async handler(request, reply) {
        const account = await readVerificationAccount(db, request, config.secretKey);
        if (!account || !hasVerification(account)) return account ? verificationRequired : securityError('NL');
        if (!validCsrf(request, siteUrl)) return reply.code(403).send(securityError('RJ'));
        let error: string | null;
        if (action === 'setup') {
          const setup = await beginFactorSetup(db, account, config.cipherKey);
          if (!setup.error) return { status: 'DONE', body: { qrCode: setup.image, recoveryKey: setup.recovery } };
          error = setup.error;
        } else {
          error =
            action === 'activate'
              ? await activateFactor(db, account, config.cipherKey, formInput(request).code)
              : await disableFactor(db, account);
          if (!error && action === 'activate')
            return { status: 'DONE', body: { message: systemMessage('Two-factor authentication has been enabled.') } };
        }
        return factorError(error, action);
      },
    });
  }
}
