import type { Prisma, PrismaClient } from '@prisma/client';
import type { FastifyRequest } from 'fastify';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { buildImageCleanupPlan, executeImageCleanupPlan, imageCleanupPlanApi } from './image-cleanup.js';
import { publicPostWhere } from '../../posts/data/visibility.js';
import { readDatabaseBytes } from '../data/database-size.js';
import { AdminSettingsOptions, ApiResult, Body, isRecord } from '../shared.js';

/** Stored with each confirmation and signed into its token, so issued values stay valid. */
export const utilityActions = {
  cleanTags: 'clean_tags',
  cleanSessions: 'clean_sessions',
  cleanLogs: 'clean_logs',
  cleanImages: 'clean_images',
} as const;

export type UtilityAction = (typeof utilityActions)[keyof typeof utilityActions];

export type UtilityParameters = Record<string, unknown>;

interface UtilityConfirmationPayload {
  userId: number;
  sessionFingerprint: string;
  action: UtilityAction;
  parameters: UtilityParameters;
  nonce: string;
  issuedAt: number;
}

function utilitySessionFingerprint(request: FastifyRequest): string {
  const cookieHeader = request.headers.cookie ?? '';
  let sessionToken = '';
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0 || part.slice(0, separator).trim() !== 'blexsessionid') continue;
    try {
      sessionToken = decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      sessionToken = '';
    }
    break;
  }
  return typeof sessionToken === 'string' && sessionToken
    ? createHash('sha256').update(sessionToken).digest('hex')
    : '';
}

function utilityParameters(action: UtilityAction, body: Body): UtilityParameters {
  if (action === utilityActions.cleanSessions) return { cleanAll: body.cleanAll === true };
  if (action === utilityActions.cleanImages) {
    const target = body.target ?? 'all';
    if (typeof target !== 'string' || !['all', 'content', 'title', 'avatar'].includes(target)) {
      throw new Error('유효한 정리 대상을 선택해주세요.');
    }
    return { target, removeDuplicates: body.removeDuplicates === true };
  }
  return {};
}

function utilityTokenSignature(value: string, secretKey: string): Buffer {
  return createHmac('sha256', secretKey).update('blex.utility-cleanup\0').update(value).digest();
}

/** The 3.x screen returns only the token, so the signed preview hash is read back from it. */
function signedPreviewHash(token: unknown): string {
  if (typeof token !== 'string') return '';
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[0] ?? '', 'base64url').toString('utf8')) as unknown;
    const hash = isRecord(payload) && isRecord(payload.parameters) ? payload.parameters.previewHash : '';
    return typeof hash === 'string' ? hash : '';
  } catch {
    return '';
  }
}

async function issueUtilityConfirmation(
  db: PrismaClient,
  userId: number,
  sessionFingerprint: string,
  action: UtilityAction,
  parameters: UtilityParameters,
  secretKey: string,
): Promise<string> {
  const payload: UtilityConfirmationPayload = {
    userId,
    sessionFingerprint,
    action,
    parameters,
    nonce: randomBytes(16).toString('base64url'),
    issuedAt: Date.now(),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = utilityTokenSignature(encodedPayload, secretKey).toString('base64url');
  const token = `${encodedPayload}.${signature}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);
  const tokenHash = createHash('sha256').update(token).digest('hex');
  await db.$transaction(async (transaction) => {
    await transaction.cleanupConfirmation.deleteMany({ where: { expiresAt: { lte: now } } });
    await transaction.cleanupConfirmation.create({
      data: { tokenHash, action, sessionFingerprint, expiresAt, createdAt: now, userId },
      select: { id: true },
    });
  });
  return token;
}

async function consumeUtilityConfirmation(
  transaction: Prisma.TransactionClient,
  tokenValue: unknown,
  userId: number,
  sessionFingerprint: string,
  action: UtilityAction,
  parameters: UtilityParameters,
  secretKey: string,
): Promise<void> {
  if (typeof tokenValue !== 'string') throw new Error('invalid utility confirmation');
  const parts = tokenValue.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw new Error('invalid utility confirmation');
  let payload: unknown;
  let receivedSignature: Buffer;
  try {
    payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as unknown;
    receivedSignature = Buffer.from(parts[1], 'base64url');
  } catch {
    throw new Error('invalid utility confirmation');
  }
  const expectedSignature = utilityTokenSignature(parts[0], secretKey);
  if (receivedSignature.length !== expectedSignature.length || !timingSafeEqual(receivedSignature, expectedSignature)) {
    throw new Error('invalid utility confirmation');
  }
  if (
    !isRecord(payload) ||
    payload.userId !== userId ||
    payload.sessionFingerprint !== sessionFingerprint ||
    payload.action !== action ||
    !isRecord(payload.parameters) ||
    JSON.stringify(payload.parameters) !== JSON.stringify(parameters) ||
    typeof payload.issuedAt !== 'number' ||
    payload.issuedAt > Date.now() ||
    Date.now() - payload.issuedAt > 5 * 60 * 1000 ||
    typeof payload.nonce !== 'string' ||
    !payload.nonce
  ) {
    throw new Error('invalid utility confirmation');
  }
  const tokenHash = createHash('sha256').update(tokenValue).digest('hex');
  const now = new Date();
  const consumed = await transaction.cleanupConfirmation.updateMany({
    where: { tokenHash, userId, action, sessionFingerprint, expiresAt: { gt: now }, consumedAt: null },
    data: { consumedAt: now },
  });
  if (consumed.count !== 1) throw new Error('invalid utility confirmation');
}

function retentionDays(name: string, defaultValue: number): number {
  const configured = Number(process.env[name]);
  return Number.isSafeInteger(configured) && configured > 0 ? configured : defaultValue;
}

export async function readUtilityStats(db: PrismaClient): Promise<Record<string, unknown>> {
  const now = new Date();
  const active = { deletedAt: null };
  const totalPosts = await db.post.count();
  const publicPosts = await db.post.count({ where: publicPostWhere(now) });
  const publishedPosts = await db.post.count({ where: { ...active, publishedAt: { lte: now } } });
  const scheduledPosts = await db.post.count({ where: { ...active, publishedAt: { gt: now } } });
  const hiddenPosts = await db.post.count({ where: { isHidden: true } });
  const draftPosts = await db.post.count({ where: { ...active, publishedAt: null } });
  const totalUsers = await db.user.count();
  const activeProfiles = await db.profile.count();
  const totalSessions = await db.session.count();
  const expiredSessions = await db.session.count({ where: { expiresAt: { lt: now } } });
  const totalComments = await db.comment.count();
  const totalSeries = await db.series.count();
  const imageCacheCount = await db.uploadedImage.count();
  const logCount = await db.adminLog.count();
  const developerRequestLogCount = await db.developerRequestLog.count();
  let dbSize = 'N/A';
  try {
    const bytes = await readDatabaseBytes(db);
    if (bytes !== null) dbSize = `${Math.round((bytes / 1024 / 1024) * 100) / 100} MB`;
  } catch {
    // Some SQLite adapters disallow PRAGMA through prepared statements.
  }
  return {
    totalPosts,
    publicPosts,
    publishedPosts,
    scheduledPosts,
    hiddenPosts,
    draftPosts,
    totalComments,
    totalUsers,
    activeProfiles,
    totalSeries,
    totalSessions,
    expiredSessions,
    imageCacheCount,
    logCount,
    developerRequestLogCount,
    dbSize,
  };
}

async function runUtilityCleanup(
  db: Prisma.TransactionClient | PrismaClient,
  action: UtilityAction,
  parameters: UtilityParameters,
  dryRun: boolean,
  mediaRoot?: string,
): Promise<Record<string, unknown>> {
  if (action === utilityActions.cleanImages) {
    const plan = await buildImageCleanupPlan(db, mediaRoot, parameters);
    return imageCleanupPlanApi(plan, dryRun);
  }
  if (action === utilityActions.cleanTags) {
    const total = await db.tag.count();
    const used = await db.tag.count({ where: { posts: { some: {} } } });
    const unusedRows = await db.tag.findMany({
      where: { posts: { none: {} } },
      orderBy: { id: 'asc' },
      select: { name: true },
    });
    const topTags = await db.tag.findMany({
      where: { posts: { some: {} } },
      orderBy: [{ posts: { _count: 'desc' } }, { id: 'asc' }],
      take: 10,
      select: { name: true, _count: { select: { posts: true } } },
    });
    const deleted = dryRun ? 0 : (await db.tag.deleteMany({ where: { posts: { none: {} } } })).count;
    return {
      totalTags: total,
      usedTags: used,
      unusedTags: Math.max(0, total - used),
      topTags: topTags.map((tag) => ({ name: tag.name, count: tag._count.posts })),
      cleanedCount: deleted || unusedRows.length,
      cleanedTags: unusedRows.slice(0, 20).map((row) => row.name),
      dryRun,
    };
  }
  if (action === utilityActions.cleanSessions) {
    const expired = { expiresAt: { lt: new Date() } };
    const totalSessions = await db.session.count();
    const expiredSessions = await db.session.count({ where: expired });
    const cleanAll = parameters.cleanAll === true;
    let deleted = 0;
    if (!dryRun) deleted = (await db.session.deleteMany({ where: cleanAll ? {} : expired })).count;
    return {
      totalSessions,
      expiredSessions,
      cleanedCount: deleted,
      cleanAll,
      dryRun,
    };
  }
  const adminRetention = retentionDays('ADMIN_AUDIT_LOG_RETENTION_DAYS', 365);
  const developerRetention = retentionDays('DEVELOPER_API_LOG_RETENTION_DAYS', 30);
  const adminCutoff = new Date(Date.now() - adminRetention * 24 * 60 * 60 * 1000);
  const developerCutoff = new Date(Date.now() - developerRetention * 24 * 60 * 60 * 1000);
  const logCount = await db.adminLog.count();
  const expiredLogCount = await db.adminLog.count({ where: { createdAt: { lt: adminCutoff } } });
  const developerRequestLogCount = await db.developerRequestLog.count();
  const expiredDeveloperRequestLogCount = await db.developerRequestLog.count({
    where: { createdAt: { lt: developerCutoff } },
  });
  const cleanedLogs = dryRun ? 0 : (await db.adminLog.deleteMany({ where: { createdAt: { lt: adminCutoff } } })).count;
  const cleanedDeveloperLogs = dryRun
    ? 0
    : (await db.developerRequestLog.deleteMany({ where: { createdAt: { lt: developerCutoff } } })).count;
  return {
    logCount,
    adminAuditLogRetentionDays: adminRetention,
    expiredLogCount,
    cleanedCount: cleanedLogs,
    developerRequestLogCount,
    developerApiLogRetentionDays: developerRetention,
    expiredDeveloperRequestLogCount,
    cleanedDeveloperRequestLogCount: cleanedDeveloperLogs,
    dryRun,
  };
}

async function recordUtilityAudit(
  transaction: Prisma.TransactionClient,
  userId: number,
  action: UtilityAction,
  phase: 'started' | 'completed' = 'completed',
): Promise<number> {
  const messages: Record<UtilityAction, string> = {
    [utilityActions.cleanTags]: 'Executed unused tag cleanup',
    [utilityActions.cleanSessions]: 'Executed session cleanup',
    [utilityActions.cleanLogs]: 'Executed expired log cleanup',
    [utilityActions.cleanImages]:
      phase === 'started' ? 'Started unused image cleanup' : 'Executed unused image cleanup',
  };
  const log = await transaction.adminLog.create({
    data: { userId, target: 'logentry', objectName: 'System utilities', action: 2, message: messages[action] },
    select: { id: true },
  });
  return log.id;
}

export async function runUtilityAction(
  db: PrismaClient,
  request: FastifyRequest,
  userId: number,
  action: UtilityAction,
  body: Body,
  options: AdminSettingsOptions,
): Promise<ApiResult<Record<string, unknown>>> {
  const fingerprint = utilitySessionFingerprint(request);
  if (!fingerprint) return { ok: false, code: 'RJ', message: 'A signed-in session is required.' };
  let parameters: UtilityParameters;
  try {
    parameters = utilityParameters(action, body);
  } catch (error) {
    return { ok: false, code: 'VA', message: error instanceof Error ? error.message : 'Invalid cleanup parameters.' };
  }
  if (action === utilityActions.cleanImages) {
    if (!options.mediaRoot) return { ok: false, code: 'RJ', message: 'Image cleanup storage is unavailable.' };
    if (body.dryRun !== false) {
      try {
        const plan = await buildImageCleanupPlan(db, options.mediaRoot, parameters);
        const confirmationToken = await issueUtilityConfirmation(
          db,
          userId,
          fingerprint,
          action,
          { ...parameters, previewHash: plan.previewHash },
          options.secretKey,
        );
        return { ok: true, body: { ...imageCleanupPlanApi(plan, true), confirmationToken } };
      } catch (error) {
        return {
          ok: false,
          code: 'VA',
          message: error instanceof Error ? error.message : 'Could not preview image cleanup.',
        };
      }
    }
    const previewHash =
      typeof body.previewHash === 'string' ? body.previewHash : signedPreviewHash(body.confirmationToken);
    if (!/^[a-f0-9]{64}$/.test(previewHash)) {
      return { ok: false, code: 'RJ', message: '미리보기 확인이 만료되었거나 유효하지 않습니다.' };
    }
    const boundParameters = { ...parameters, previewHash };
    let auditId: number;
    try {
      auditId = await db.$transaction(async (transaction) => {
        await consumeUtilityConfirmation(
          transaction,
          body.confirmationToken,
          userId,
          fingerprint,
          action,
          boundParameters,
          options.secretKey,
        );
        return recordUtilityAudit(transaction, userId, action, 'started');
      });
    } catch (error) {
      if (String(error).includes('invalid utility confirmation')) {
        return { ok: false, code: 'RJ', message: '미리보기 확인이 만료되었거나 유효하지 않습니다.' };
      }
      throw error;
    }
    try {
      const result = await db.$transaction(
        async (transaction) => {
          const plan = await buildImageCleanupPlan(transaction, options.mediaRoot, parameters);
          if (plan.previewHash !== previewHash) throw new Error('image cleanup preview changed');
          return executeImageCleanupPlan(transaction, options.mediaRoot as string, plan);
        },
        { timeout: 120_000 },
      );
      await db.adminLog.updateMany({ where: { id: auditId }, data: { message: 'Executed unused image cleanup' } });
      return { ok: true, body: result };
    } catch (error) {
      if (String(error).includes('image cleanup preview changed')) {
        return { ok: false, code: 'RJ', message: '미리보기 확인이 만료되었거나 유효하지 않습니다.' };
      }
      return { ok: false, code: 'VA', message: 'Image cleanup stopped safely; review the utility audit log.' };
    }
  }
  if (body.dryRun !== false) {
    const result = await runUtilityCleanup(db, action, parameters, true, options.mediaRoot);
    const confirmationToken = await issueUtilityConfirmation(
      db,
      userId,
      fingerprint,
      action,
      parameters,
      options.secretKey,
    );
    return { ok: true, body: { ...result, confirmationToken } };
  }
  try {
    const result = await db.$transaction(async (transaction) => {
      await consumeUtilityConfirmation(
        transaction,
        body.confirmationToken,
        userId,
        fingerprint,
        action,
        parameters,
        options.secretKey,
      );
      const cleaned = await runUtilityCleanup(transaction, action, parameters, false);
      await recordUtilityAudit(transaction, userId, action);
      return cleaned;
    });
    return { ok: true, body: result };
  } catch (error) {
    if (String(error).includes('invalid utility confirmation')) {
      return { ok: false, code: 'RJ', message: '미리보기 확인이 만료되었거나 유효하지 않습니다.' };
    }
    throw error;
  }
}
