import { Prisma, type PrismaClient } from '@prisma/client';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { adminSettingsCapabilities, type UserAccess } from '../access.js';
import { renderAdminUtilities, type AdminSettingsUser, type AdminUtilityAction } from '../pages.js';
import { buildImageCleanupPlan, executeImageCleanupPlan, imageCleanupPlanApi } from './image-cleanup.js';
import { AdminSettingsOptions, ApiResult, Body, csrfToken, djangoTimestamp, isRecord, pageNumber } from '../shared.js';

export type UtilityAction = 'clean_tags' | 'clean_sessions' | 'clean_logs' | 'clean_images';

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
  if (action === 'clean_sessions') return { cleanAll: body.clean_all === true };
  if (action === 'clean_images') {
    const target = body.target ?? 'all';
    if (typeof target !== 'string' || !['all', 'content', 'title', 'avatar'].includes(target)) {
      throw new Error('유효한 정리 대상을 선택해주세요.');
    }
    return { target, removeDuplicates: body.remove_duplicates === true };
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
  const now = djangoTimestamp();
  const expiresAt = djangoTimestamp(new Date(Date.now() + 5 * 60 * 1000));
  const tokenHash = createHash('sha256').update(token).digest('hex');
  await db.$transaction(async (transaction) => {
    await transaction.$executeRaw`DELETE FROM board_utilitycleanupconfirmation WHERE expires_at <= ${now}`;
    await transaction.$executeRaw`
      INSERT INTO board_utilitycleanupconfirmation
        (token_hash, action, session_fingerprint, expires_at, consumed_at, created_date, user_id)
      VALUES (${tokenHash}, ${action}, ${sessionFingerprint}, ${expiresAt}, NULL, ${now}, ${userId})
    `;
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
  if (!isRecord(payload)
      || payload.userId !== userId
      || payload.sessionFingerprint !== sessionFingerprint
      || payload.action !== action
      || !isRecord(payload.parameters)
      || JSON.stringify(payload.parameters) !== JSON.stringify(parameters)
      || typeof payload.issuedAt !== 'number'
      || payload.issuedAt > Date.now()
      || Date.now() - payload.issuedAt > 5 * 60 * 1000
      || typeof payload.nonce !== 'string'
      || !payload.nonce) {
    throw new Error('invalid utility confirmation');
  }
  const tokenHash = createHash('sha256').update(tokenValue).digest('hex');
  const now = djangoTimestamp();
  const consumed = await transaction.$executeRaw`
    UPDATE board_utilitycleanupconfirmation SET consumed_at = ${now}
    WHERE token_hash = ${tokenHash} AND user_id = ${userId} AND action = ${action}
      AND session_fingerprint = ${sessionFingerprint} AND expires_at > ${now} AND consumed_at IS NULL
  `;
  if (consumed !== 1) throw new Error('invalid utility confirmation');
}

function retentionDays(name: string, defaultValue: number): number {
  const configured = Number(process.env[name]);
  return Number.isSafeInteger(configured) && configured > 0 ? configured : defaultValue;
}

export async function readUtilityStats(db: PrismaClient): Promise<Record<string, unknown>> {
  const now = djangoTimestamp();
  const epoch = BigInt(Date.now());
  const [stats] = await db.$queryRaw<Array<Record<string, number | bigint>>>(Prisma.sql`
    SELECT
      (SELECT COUNT(*) FROM board_post) AS total_posts,
      COALESCE(SUM(CASE WHEN post.deleted_date IS NULL AND post.published_date IS NOT NULL AND post.published_date <= ${now} AND config.hide = 0 THEN 1 ELSE 0 END), 0) AS public_posts,
      COALESCE(SUM(CASE WHEN post.deleted_date IS NULL AND post.published_date IS NOT NULL AND post.published_date <= ${now} THEN 1 ELSE 0 END), 0) AS published_posts,
      COALESCE(SUM(CASE WHEN post.deleted_date IS NULL AND post.published_date > ${now} THEN 1 ELSE 0 END), 0) AS scheduled_posts,
      COALESCE(SUM(CASE WHEN config.hide = 1 THEN 1 ELSE 0 END), 0) AS hidden_posts,
      COALESCE(SUM(CASE WHEN post.deleted_date IS NULL AND post.published_date IS NULL THEN 1 ELSE 0 END), 0) AS draft_posts,
      (SELECT COUNT(*) FROM board_comment) AS total_comments,
      (SELECT COUNT(*) FROM auth_user) AS total_users,
      (SELECT COUNT(*) FROM board_profile) AS active_profiles,
      (SELECT COUNT(*) FROM board_series) AS total_series,
      (SELECT COUNT(*) FROM board_imagecache) AS image_cache_count,
      (SELECT COUNT(*) FROM blex_session) AS total_sessions,
      (SELECT COUNT(*) FROM blex_session WHERE expires_at < ${epoch}) AS expired_sessions
    FROM board_post AS post LEFT JOIN board_postconfig AS config ON config.post_id = post.id
  `);
  const [logs] = await db.$queryRaw<Array<{ logCount: number | bigint; developerRequestLogCount: number | bigint }>>`
    SELECT (SELECT COUNT(*) FROM django_admin_log) AS logCount,
      (SELECT COUNT(*) FROM board_developerrequestlog) AS developerRequestLogCount
  `;
  let dbSize = 'N/A';
  try {
    const [pageCount] = await db.$queryRaw<Array<{ page_count: number | bigint }>>`PRAGMA page_count`;
    const [pageSize] = await db.$queryRaw<Array<{ page_size: number | bigint }>>`PRAGMA page_size`;
    if (pageCount && pageSize) dbSize = `${Math.round(Number(pageCount.page_count) * Number(pageSize.page_size) / 1024 / 1024 * 100) / 100} MB`;
  } catch {
    // Some SQLite adapters disallow PRAGMA through prepared statements.
  }
  return {
    ...Object.fromEntries(Object.entries(stats ?? {}).map(([key, value]) => [key, Number(value)])),
    log_count: Number(logs?.logCount ?? 0),
    developer_request_log_count: Number(logs?.developerRequestLogCount ?? 0),
    db_size: dbSize,
  };
}

async function runUtilityCleanup(
  db: Prisma.TransactionClient | PrismaClient,
  action: UtilityAction,
  parameters: UtilityParameters,
  dryRun: boolean,
  mediaRoot?: string,
): Promise<Record<string, unknown>> {
  if (action === 'clean_images') {
    const plan = await buildImageCleanupPlan(db, mediaRoot, parameters);
    return imageCleanupPlanApi(plan, dryRun);
  }
  if (action === 'clean_tags') {
    const [counts] = await db.$queryRaw<Array<{ totalTags: number | bigint; usedTags: number | bigint }>>`
      SELECT COUNT(*) AS totalTags,
        SUM(CASE WHEN EXISTS (SELECT 1 FROM board_post_tags AS relation WHERE relation.tag_id = tag.id) THEN 1 ELSE 0 END) AS usedTags
      FROM board_tag AS tag
    `;
    const unusedRows = await db.$queryRaw<Array<{ value: string }>>`
      SELECT tag.value FROM board_tag AS tag
      WHERE NOT EXISTS (SELECT 1 FROM board_post_tags AS relation WHERE relation.tag_id = tag.id)
      ORDER BY tag.id
    `;
    const topTags = await db.$queryRaw<Array<{ name: string; count: number | bigint }>>`
      SELECT tag.value AS name, COUNT(relation.post_id) AS count
      FROM board_tag AS tag JOIN board_post_tags AS relation ON relation.tag_id = tag.id
      GROUP BY tag.id, tag.value ORDER BY count DESC LIMIT 10
    `;
    const deleted = dryRun ? 0 : await db.$executeRaw`
      DELETE FROM board_tag WHERE NOT EXISTS (
        SELECT 1 FROM board_post_tags AS relation WHERE relation.tag_id = board_tag.id
      )
    `;
    const total = Number(counts?.totalTags ?? 0);
    const used = Number(counts?.usedTags ?? 0);
    return {
      total_tags: total,
      used_tags: used,
      unused_tags: Math.max(0, total - used),
      top_tags: topTags.map((tag) => ({ name: tag.name, count: Number(tag.count) })),
      cleaned_count: Number(deleted || unusedRows.length),
      cleaned_tags: unusedRows.slice(0, 20).map((row) => row.value),
      dry_run: dryRun,
    };
  }
  if (action === 'clean_sessions') {
    const now = BigInt(Date.now());
    const legacyNow = djangoTimestamp();
    const [counts] = await db.$queryRaw<Array<{ total: number | bigint; expired: number | bigint }>>`
      SELECT (SELECT COUNT(*) FROM blex_session) + (SELECT COUNT(*) FROM django_session) AS total,
        (SELECT COUNT(*) FROM blex_session WHERE expires_at < ${now})
          + (SELECT COUNT(*) FROM django_session WHERE expire_date < ${legacyNow}) AS expired
    `;
    const cleanAll = parameters.cleanAll === true;
    let deleted = 0;
    if (!dryRun) {
      deleted = cleanAll
        ? Number(await db.$executeRaw`DELETE FROM blex_session`) + Number(await db.$executeRaw`DELETE FROM django_session`)
        : Number(await db.$executeRaw`DELETE FROM blex_session WHERE expires_at < ${now}`)
          + Number(await db.$executeRaw`DELETE FROM django_session WHERE expire_date < ${legacyNow}`);
    }
    return {
      total_sessions: Number(counts?.total ?? 0),
      expired_sessions: Number(counts?.expired ?? 0),
      cleaned_count: Number(deleted),
      clean_all: cleanAll,
      dry_run: dryRun,
    };
  }
  const adminRetention = retentionDays('ADMIN_AUDIT_LOG_RETENTION_DAYS', 365);
  const developerRetention = retentionDays('DEVELOPER_API_LOG_RETENTION_DAYS', 30);
  const adminCutoff = djangoTimestamp(new Date(Date.now() - adminRetention * 24 * 60 * 60 * 1000));
  const developerCutoff = djangoTimestamp(new Date(Date.now() - developerRetention * 24 * 60 * 60 * 1000));
  const [counts] = await db.$queryRaw<Array<{
    logCount: number | bigint;
    expiredLogCount: number | bigint;
    developerCount: number | bigint;
    expiredDeveloperCount: number | bigint;
  }>>`
    SELECT COUNT(*) AS logCount,
      SUM(CASE WHEN action_time < ${adminCutoff} THEN 1 ELSE 0 END) AS expiredLogCount,
      (SELECT COUNT(*) FROM board_developerrequestlog) AS developerCount,
      (SELECT COUNT(*) FROM board_developerrequestlog WHERE created_date < ${developerCutoff}) AS expiredDeveloperCount
    FROM django_admin_log
  `;
  const cleanedLogs = dryRun ? 0 : await db.$executeRaw`DELETE FROM django_admin_log WHERE action_time < ${adminCutoff}`;
  const cleanedDeveloperLogs = dryRun ? 0 : await db.$executeRaw`DELETE FROM board_developerrequestlog WHERE created_date < ${developerCutoff}`;
  return {
    log_count: Number(counts?.logCount ?? 0),
    admin_audit_log_retention_days: adminRetention,
    expired_log_count: Number(counts?.expiredLogCount ?? 0),
    cleaned_count: Number(cleanedLogs),
    developer_request_log_count: Number(counts?.developerCount ?? 0),
    developer_api_log_retention_days: developerRetention,
    expired_developer_request_log_count: Number(counts?.expiredDeveloperCount ?? 0),
    cleaned_developer_request_log_count: Number(cleanedDeveloperLogs),
    dry_run: dryRun,
  };
}

async function recordUtilityAudit(
  transaction: Prisma.TransactionClient,
  userId: number,
  action: UtilityAction,
  phase: 'started' | 'completed' = 'completed',
): Promise<number | null> {
  const changeMessages: Record<UtilityAction, string> = {
    clean_tags: 'Executed unused tag cleanup',
    clean_sessions: 'Executed session cleanup',
    clean_logs: 'Executed expired log cleanup',
    clean_images: phase === 'started' ? 'Started unused image cleanup' : 'Executed unused image cleanup',
  };
  await transaction.$executeRaw`INSERT OR IGNORE INTO django_content_type (app_label, model) VALUES ('admin', 'logentry')`;
  const [contentType] = await transaction.$queryRaw<Array<{ id: number }>>`
    SELECT id FROM django_content_type WHERE app_label = 'admin' AND model = 'logentry' LIMIT 1
  `;
  if (!contentType) return null;
  await transaction.$executeRaw`
    INSERT INTO django_admin_log (object_id, object_repr, action_flag, change_message, content_type_id, user_id, action_time)
    VALUES (NULL, 'System utilities', 2, ${changeMessages[action]}, ${contentType.id}, ${userId}, ${djangoTimestamp()})
  `;
  const [row] = await transaction.$queryRaw<Array<{ id: number }>>`SELECT last_insert_rowid() AS id`;
  return row ? Number(row.id) : null;
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
  if (action === 'clean_images') {
    if (!options.mediaRoot) return { ok: false, code: 'RJ', message: 'Image cleanup storage is unavailable.' };
    if (body.dry_run !== false) {
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
        return { ok: true, body: { ...imageCleanupPlanApi(plan, true), confirmation_token: confirmationToken } };
      } catch (error) {
        return { ok: false, code: 'VA', message: error instanceof Error ? error.message : 'Could not preview image cleanup.' };
      }
    }
    const previewHash = typeof body.preview_hash === 'string' ? body.preview_hash : signedPreviewHash(body.confirmation_token);
    if (!/^[a-f0-9]{64}$/.test(previewHash)) {
      return { ok: false, code: 'RJ', message: '미리보기 확인이 만료되었거나 유효하지 않습니다.' };
    }
    const boundParameters = { ...parameters, previewHash };
    let auditId: number;
    try {
      auditId = await db.$transaction(async (transaction) => {
        await consumeUtilityConfirmation(
          transaction,
          body.confirmation_token,
          userId,
          fingerprint,
          action,
          boundParameters,
          options.secretKey,
        );
        const createdAuditId = await recordUtilityAudit(transaction, userId, action, 'started');
        if (createdAuditId === null) throw new Error('Image cleanup audit could not be recorded.');
        return createdAuditId;
      });
    } catch (error) {
      if (String(error).includes('invalid utility confirmation')) {
        return { ok: false, code: 'RJ', message: '미리보기 확인이 만료되었거나 유효하지 않습니다.' };
      }
      throw error;
    }
    try {
      const result = await db.$transaction(async (transaction) => {
        const plan = await buildImageCleanupPlan(transaction, options.mediaRoot, parameters);
        if (plan.previewHash !== previewHash) throw new Error('image cleanup preview changed');
        return executeImageCleanupPlan(transaction, options.mediaRoot as string, plan);
      }, { timeout: 120_000 });
      await db.$transaction(async (transaction) => {
        await transaction.$executeRaw`
          UPDATE django_admin_log SET change_message = 'Executed unused image cleanup' WHERE id = ${auditId}
        `;
      });
      return { ok: true, body: result };
    } catch (error) {
      if (String(error).includes('image cleanup preview changed')) {
        return { ok: false, code: 'RJ', message: '미리보기 확인이 만료되었거나 유효하지 않습니다.' };
      }
      return { ok: false, code: 'VA', message: 'Image cleanup stopped safely; review the utility audit log.' };
    }
  }
  if (body.dry_run !== false) {
    const result = await runUtilityCleanup(db, action, parameters, true, options.mediaRoot);
    const confirmationToken = await issueUtilityConfirmation(db, userId, fingerprint, action, parameters, options.secretKey);
    return { ok: true, body: { ...result, confirmation_token: confirmationToken } };
  }
  try {
    const result = await db.$transaction(async (transaction) => {
      await consumeUtilityConfirmation(
        transaction,
        body.confirmation_token,
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

export async function pageUtilities(
  request: FastifyRequest,
  reply: FastifyReply,
  db: PrismaClient,
  options: AdminSettingsOptions,
  user: AdminSettingsUser,
  access: UserAccess,
  feedback?: { action: AdminUtilityAction; data: Record<string, unknown>; confirmationToken?: string; cleanAll?: boolean },
  error?: string,
) {
  return reply.type('text/html; charset=utf-8').send(renderAdminUtilities({
    user,
    capabilities: adminSettingsCapabilities(access),
    stats: await readUtilityStats(db),
    csrfToken: csrfToken(request),
    feedback,
    saved: !error && pageNumber(request).get('saved') === '1',
    error,
  }));
}
