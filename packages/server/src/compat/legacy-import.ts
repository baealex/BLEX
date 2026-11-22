import { cp, lstat, rename, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { verifyLegacyDatabase } from './legacy-database.js';

const discardedTables = new Set(['django_migrations', 'django_session', 'django_site', 'board_oauthauthorization', 'board_seriesconfigmeta']);

const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;

type ColumnMapping = string | {
  to: string;
  /** Reads a derived value instead of the source column of the same name. */
  sql?: string;
  convert?(value: SQLInputValue, source: string, id: SQLInputValue): SQLInputValue;
};

interface TableMapping {
  to: string;
  columns: Record<string, ColumnMapping>;
  where?: string;
}

/** 3.x stored naive UTC text, sometimes with an offset. Prisma stores SQLite dates as epoch milliseconds. */
export function legacyDate(value: SQLInputValue): SQLInputValue {
  if (value === null) return null;
  const text = String(value).trim().replace(' ', 'T');
  const dated = text.includes('T') ? text : `${text}T00:00:00`;
  const milliseconds = Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/.test(dated) ? dated : `${dated}Z`);
  if (!Number.isFinite(milliseconds)) throw new Error(`Found an unreadable date: ${String(value)}.`);
  return BigInt(milliseconds);
}

const date = (to: string): ColumnMapping => ({ to, convert: legacyDate });

function rejectedValue(source: string, id: SQLInputValue, value: SQLInputValue, accepted: string) {
  return new Error(`${source} in row ${String(id)} is "${String(value)}", but BLEX 4 only accepts ${accepted}. Correct that row in the 3.14 database and start again.`);
}

/** Prisma fails every later read of a value outside its enum, so a hand-edited row stops the import here. */
const choice = (to: string, allowed: readonly string[]): ColumnMapping => ({
  to,
  convert(value, source, id) {
    if (typeof value === 'string' && allowed.includes(value)) return value;
    throw rejectedValue(source, id, value, allowed.join(', '));
  },
});

/** Prisma also fails every later read of an Int column holding a wider number. */
const int32 = (to: string): ColumnMapping => ({
  to,
  convert(value, source, id) {
    if (typeof value === 'bigint' && value >= -2147483648n && value <= 2147483647n) return value;
    throw rejectedValue(source, id, value, 'a 32-bit integer');
  },
});

const contentScope = choice('scope', ['user', 'global']);

/** Prisma dates stop at milliseconds, so the rest of a 3.x timestamp's six fractional digits is kept beside it. */
const subMillisecond = (column: string, to: string): ColumnMapping => ({
  to,
  sql: quote(column),
  convert(value) {
    const fraction = /\.(\d+)/.exec(String(value))?.[1] ?? '';
    return BigInt(fraction.padEnd(6, '0').slice(3, 6));
  },
});

/** Readers treat anything but a JSON object as an empty manifest, and the JSONB column would coerce bare numbers. */
const jsonObject = (to: string, fallback: string | null = null): ColumnMapping => ({
  to,
  convert(value) {
    if (typeof value !== 'string') return fallback;
    try {
      const parsed: unknown = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? value : fallback;
    } catch {
      return fallback;
    }
  },
});

/** 3.x treated anything but a JSON array as no scopes and skipped non-string items, so the stored list says the same. */
const scopeList = (to: string): ColumnMapping => ({
  to,
  convert(value) {
    try {
      const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : null;
      return JSON.stringify(Array.isArray(parsed) ? parsed.filter((scope) => typeof scope === 'string') : []);
    } catch {
      return '[]';
    }
  },
});

/**
 * 3.14 only ever wrote id 1. Public branding reads the lowest id, while every other reader asks for id 1,
 * so a database without row 1 keeps the fields branding showed and the defaults everything else showed.
 */
const unlessPrimary = (column: string, to: string, fallback: string): ColumnMapping => ({
  to,
  sql: `CASE WHEN id = 1 THEN ${quote(column)} ELSE ${fallback} END`,
});

const tableMappings: Record<string, TableMapping> = {
  board_worklog: { to: 'WorkLog', columns: { id: 'id', owner_id: 'ownerId', title: 'title', created_at: date('createdAt') } },
  board_worklogentry: {
    to: 'WorkLogEntry',
    columns: { id: 'id', log_id: 'logId', title: 'title', text: 'text', media_type: 'mediaType', attachment: 'attachment', created_at: date('createdAt') },
  },
  board_worklogshare: { to: 'WorkLogShare', columns: { id: 'id', log_id: 'logId', token: 'token', headline: 'headline', created_at: date('createdAt') } },
  board_worklogshare_entries: { to: '_WorkLogEntryToWorkLogShare', columns: { worklogentry_id: 'A', worklogshare_id: 'B' } },
  board_form: {
    to: 'FormTemplate',
    columns: { id: 'id', user_id: 'userId', title: 'title', content: 'content', is_public: 'isPublic', created_date: date('createdAt'), updated_date: date('updatedAt') },
  },
  board_staticpage: {
    to: 'StaticPage',
    columns: {
      id: 'id', author_id: 'authorId', slug: 'slug', title: 'title', content: 'content', meta_description: 'description',
      is_published: 'isPublished', show_in_footer: 'showInFooter', order: int32('order'), created_date: date('createdAt'), updated_date: date('updatedAt'),
    },
  },
  board_sitenotice: {
    to: 'SiteNotice',
    columns: {
      id: 'id', user_id: 'userId', scope: contentScope, title: 'title', url: 'url', is_active: 'isActive',
      order: int32('order'), created_date: date('createdAt'), updated_date: date('updatedAt'),
    },
  },
  board_sitebanner: {
    to: 'SiteBanner',
    columns: {
      id: 'id', user_id: 'userId', scope: contentScope, banner_type: choice('type', ['horizontal', 'sidebar']),
      position: choice('position', ['top', 'bottom', 'left', 'right']), title: 'title', content_html: 'contentHtml', is_active: 'isActive',
      order: int32('order'), created_date: date('createdAt'), updated_date: date('updatedAt'),
    },
  },
  board_sitesetting: {
    to: 'SiteSetting',
    where: 'id = (SELECT MIN(id) FROM board_sitesetting)',
    columns: {
      id: { to: 'id', sql: '1' },
      domain: { to: 'domain', sql: `COALESCE((SELECT domain FROM django_site WHERE id = 1), '')` },
      site_name: 'siteName', logo_svg: 'logoSvg', logo_svg_dark: 'logoSvgDark', icon_manifest: jsonObject('iconManifest'), seo_enabled: 'seoEnabled',
      header_script: unlessPrimary('header_script', 'headerScript', `''`),
      footer_script: unlessPrimary('footer_script', 'footerScript', `''`),
      aeo_enabled: unlessPrimary('aeo_enabled', 'aeoEnabled', '0'),
      robots_txt_extra_rules: unlessPrimary('robots_txt_extra_rules', 'robotsTxtExtraRules', `''`),
      icon_svg: unlessPrimary('icon_svg', 'iconSvg', `''`),
      icon_svg_dark: unlessPrimary('icon_svg_dark', 'iconSvgDark', `''`),
      updated_date: date('updatedAt'),
    },
  },
  board_loginsetting: {
    to: 'LoginSetting',
    where: 'id = 1',
    columns: {
      id: 'id', welcome_notification_message: 'welcomeNotificationMessage', welcome_notification_url: 'welcomeNotificationUrl',
      account_deletion_redirect_url: 'accountDeletionRedirectUrl', hcaptcha_enabled: 'hcaptchaEnabled', hcaptcha_site_key: 'hcaptchaSiteKey',
      hcaptcha_secret_key: 'hcaptchaSecretKey', updated_date: date('updatedAt'),
    },
  },
  board_integrationsetting: {
    to: 'IntegrationSetting',
    where: 'id = 1',
    columns: {
      id: 'id', telegram_enabled: 'telegramEnabled', telegram_bot_username: 'telegramBotUsername', telegram_bot_token: 'telegramBotToken',
      updated_date: date('updatedAt'),
    },
  },
  django_admin_log: {
    to: 'AdminLog',
    columns: {
      id: 'id', user_id: 'userId',
      content_type_id: { to: 'target', sql: `COALESCE((SELECT model FROM django_content_type WHERE id = content_type_id), '')` },
      object_id: 'objectId', object_repr: 'objectName', action_flag: int32('action'), change_message: 'message', action_time: date('createdAt'),
    },
  },
  board_utilitycleanupconfirmation: {
    to: 'CleanupConfirmation',
    columns: {
      id: 'id', user_id: 'userId', token_hash: 'tokenHash', action: 'action', session_fingerprint: 'sessionFingerprint',
      expires_at: date('expiresAt'), consumed_at: date('consumedAt'), created_date: date('createdAt'),
    },
  },
  board_imagecache: { to: 'UploadedImage', columns: { id: 'id', key: 'key', path: 'path', size: int32('size'), user_id: 'userId' } },
  board_notify: {
    to: 'Notification',
    columns: {
      id: 'id', user_id: 'userId', key: 'key', url: 'url', content: 'content', message_key: 'messageKey',
      message_params: jsonObject('messageParams', '{}'), has_read: 'isRead', created_date: date('createdAt'), updated_date: date('updatedAt'),
    },
  },
  board_webhooksubscription: {
    to: 'WebhookChannel',
    columns: {
      id: 'id',
      // 3.x owned channels through the profile row. BLEX 4 owns them through the account.
      author_id: { to: 'ownerId', sql: '(SELECT profile.user_id FROM board_profile AS profile WHERE profile.id = board_webhooksubscription.author_id)' },
      scope: contentScope, name: 'name', webhook_url: 'url', is_active: 'isActive', failure_count: int32('failureCount'),
      last_success_date: date('lastSuccessAt'), created_date: date('createdAt'),
    },
  },
  board_telegramsync: {
    to: 'TelegramConnection',
    columns: {
      user_id: 'userId', tid: 'telegramId', auth_token: 'authToken',
      // 3.x kept a stale expiry on used codes because the column was NOT NULL. Only a waiting code has an expiry now.
      auth_token_exp: { to: 'authTokenExpiresAt', sql: `CASE WHEN auth_token <> '' THEN auth_token_exp END`, convert: legacyDate },
      created_date: date('createdAt'),
    },
  },
  board_developertoken: {
    to: 'DeveloperToken',
    columns: {
      id: 'id', user_id: 'userId', name: 'name', token_prefix: 'tokenPrefix', token_hash: 'tokenHash', scopes: scopeList('scopes'),
      expires_at: date('expiresAt'), revoked_at: date('revokedAt'), last_used_at: date('lastUsedAt'), last_used_ip: 'lastUsedIp',
      created_date: date('createdAt'), updated_date: date('updatedAt'),
    },
  },
  board_series: {
    to: 'Series',
    columns: {
      id: 'id', owner_id: 'ownerId', url: 'slug', name: 'name', text_md: 'descriptionMarkdown', text_html: 'descriptionHtml',
      hide: 'isHidden', layout: 'layout', order: int32('order'), created_date: date('createdAt'), updated_date: date('updatedAt'),
      created_microseconds: subMillisecond('created_date', 'createdAtMicroseconds'),
      updated_microseconds: subMillisecond('updated_date', 'updatedAtMicroseconds'),
    },
  },
  board_comment: {
    to: 'Comment',
    columns: {
      id: 'id', post_id: 'postId', author_id: 'authorId', parent_id: 'parentId', text_md: 'markdown', text_html: 'html',
      edited: 'isEdited', heart: 'isHearted', created_date: date('createdAt'),
    },
  },
  board_comment_likes: { to: 'CommentLike', columns: { comment_id: 'commentId', user_id: 'userId' } },
  board_authorsubscription: {
    to: 'AuthorSubscription',
    columns: { id: 'id', subscriber_id: 'subscriberId', author_id: 'authorId', created_date: date('createdAt') },
  },
  board_authorsubscriptionlog: {
    to: 'AuthorSubscriptionLog',
    columns: {
      id: 'id', subscriber_id: 'subscriberId', author_id: 'authorId', action: choice('action', ['subscribe', 'unsubscribe']),
      created_date: date('createdAt'),
    },
  },
  board_developerrequestlog: {
    to: 'DeveloperRequestLog',
    columns: {
      id: 'id', user_id: 'userId', token_id: 'tokenId', method: 'method', path: 'path', status_code: int32('statusCode'),
      ip_address: 'ipAddress', user_agent: 'userAgent', created_date: date('createdAt'),
    },
  },
};

function tableNames(db: DatabaseSync) {
  const rows = db.prepare(`
    SELECT name FROM sqlite_schema
    WHERE type = 'table' AND name NOT GLOB 'sqlite_*' AND name <> '_prisma_migrations'
  `).all() as unknown as Array<{ name: string }>;
  return rows.map(({ name }) => name);
}

function columnNames(db: DatabaseSync, table: string) {
  const rows = db.prepare(`PRAGMA table_info(${quote(table)})`).all() as unknown as Array<{ name: string }>;
  return rows.map(({ name }) => name);
}

function copyTable(source: DatabaseSync, target: DatabaseSync, table: string) {
  const mapping = tableMappings[table];
  const destination = mapping?.to ?? table;
  const columns = mapping ? Object.keys(mapping.columns) : columnNames(source, table);
  const outputs = columns.map((column) => mapping?.columns[column] ?? column);
  const names = outputs.map((output) => (typeof output === 'string' ? output : output.to));
  const available = new Set(columnNames(target, destination));
  const missing = names.filter((name) => !available.has(name));
  if (missing.length) throw new Error(`The BLEX 4 schema is missing ${destination}: ${missing.join(', ')}.`);

  const selected = columns.map((column, index) => {
    const output = outputs[index];
    return typeof output !== 'string' && output.sql ? `${output.sql} AS ${quote(column)}` : quote(column);
  });
  const read = source.prepare(`SELECT ${selected.join(', ')} FROM ${quote(table)}${mapping?.where ? ` WHERE ${mapping.where}` : ''}`);
  read.setReadBigInts(true);
  const write = target.prepare(`INSERT INTO ${quote(destination)} (${names.map(quote).join(', ')}) VALUES (${names.map(() => '?').join(', ')})`);
  let copied = 0;
  for (const row of read.iterate() as Iterable<Record<string, SQLInputValue>>) {
    write.run(...columns.map((column, index) => {
      const output = outputs[index];
      return typeof output === 'string' || !output.convert ? row[column] : output.convert(row[column], `${table}.${column}`, row.id ?? null);
    }));
    copied += 1;
  }
  return copied;
}

function copyRows(sourcePath: string, targetPath: string) {
  const source = new DatabaseSync(sourcePath, { readOnly: true });
  const target = new DatabaseSync(targetPath);
  try {
    target.exec('PRAGMA foreign_keys = OFF');
    target.exec('BEGIN IMMEDIATE');
    const targetTables = new Set(tableNames(target));
    let rows = 0;
    for (const table of tableNames(source)) {
      if (discardedTables.has(table)) continue;
      if (!targetTables.has(tableMappings[table]?.to ?? table)) throw new Error(`The BLEX 4 schema has no table for ${table}.`);
      rows += copyTable(source, target, table);
    }

    // 3.x kept the RSS host in django_site, so it must survive even without a site settings row.
    const site = source.prepare('SELECT domain FROM django_site WHERE id = 1').get() as { domain: string } | undefined;
    if (site?.domain && !target.prepare('SELECT 1 FROM "SiteSetting"').get()) {
      target.prepare('INSERT INTO "SiteSetting" (id, domain, updatedAt) VALUES (1, ?, ?)').run(site.domain, Date.now());
      rows += 1;
    }

    // Keep AUTOINCREMENT counters so the IDs of deleted rows are never handed out again.
    const sequences = source.prepare('SELECT name, seq FROM sqlite_sequence');
    sequences.setReadBigInts(true);
    target.exec('DELETE FROM sqlite_sequence');
    const sequence = target.prepare('INSERT INTO sqlite_sequence (name, seq) VALUES (?, ?)');
    for (const { name, seq } of sequences.iterate() as Iterable<{ name: string; seq: bigint }>) {
      const destination = tableMappings[name]?.to ?? name;
      // A table keyed by another column (TelegramConnection by userId) has no counter worth carrying over.
      const keepsId = !tableMappings[name] || 'id' in tableMappings[name].columns;
      if (keepsId && targetTables.has(destination) && !discardedTables.has(name) && !destination.startsWith('_')) sequence.run(destination, seq);
    }

    // 3.x published scheduled posts by date alone. BLEX 4 queues them explicitly.
    target.exec(`
      INSERT INTO blex_scheduled_publication (post_id, publish_at)
      SELECT id, CAST(published_date AS TEXT) FROM board_post
      WHERE deleted_date IS NULL AND published_date > strftime('%Y-%m-%d %H:%M:%f', 'now')
    `);

    const integrity = target.prepare('PRAGMA integrity_check').all();
    if (integrity.length !== 1 || integrity[0].integrity_check !== 'ok') throw new Error('The imported database failed the integrity check.');
    if (target.prepare('PRAGMA foreign_key_check').get()) throw new Error('The imported database has foreign-key violations.');
    target.exec('COMMIT');
    return rows;
  } catch (error) {
    if (target.isTransaction) target.exec('ROLLBACK');
    throw error;
  } finally {
    source.close();
    target.close();
  }
}

async function copyMedia(legacyRoot: string, mediaRoot: string) {
  const source = join(legacyRoot, 'resources', 'media');
  if (!existsSync(source)) return;
  await cp(source, mediaRoot, {
    recursive: true,
    force: true,
    preserveTimestamps: true,
    filter: async (path) => !(await lstat(path)).isSymbolicLink(),
  });
}

async function removeDatabase(path: string) {
  await Promise.all(['', '-journal', '-wal', '-shm'].map((suffix) => rm(`${path}${suffix}`, { force: true })));
}

export interface LegacyImportOptions {
  legacyRoot: string;
  databasePath: string;
  mediaRoot?: string;
  createDatabase(path: string): Promise<void>;
}

/** Builds the BLEX 4 database beside its destination so a failed import never leaves a usable file. */
export async function importLegacyInstallation({ legacyRoot, databasePath, mediaRoot, createDatabase }: LegacyImportOptions) {
  const source = join(legacyRoot, 'db.sqlite3');
  verifyLegacyDatabase(source);
  const temporary = `${databasePath}.importing`;
  await removeDatabase(temporary);
  try {
    await createDatabase(temporary);
    const rows = copyRows(source, temporary);
    if (mediaRoot) await copyMedia(legacyRoot, mediaRoot);
    await rename(temporary, databasePath);
    return { rows };
  } catch (error) {
    await removeDatabase(temporary);
    throw error;
  }
}
