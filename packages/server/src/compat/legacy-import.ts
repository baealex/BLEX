import { cp, lstat, rename, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { verifyLegacyDatabase } from './legacy-database.js';

// Settings, preference, and permission tables are read while copying the rows they describe.
const discardedTables = new Set([
  'django_migrations', 'django_session', 'django_site', 'django_content_type', 'board_oauthauthorization', 'board_seriesconfigmeta',
  'board_editrequest', 'board_postconfig', 'board_postconfigmeta', 'board_userconfigmeta', 'board_emailchange',
  'auth_group', 'auth_group_permissions', 'auth_permission', 'auth_user_groups', 'auth_user_user_permissions',
]);

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
  /** Reads from this expression instead of the table of the same name. */
  from?: string;
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
const choiceColumn = (to: string, allowed: readonly string[]) => choice(to, allowed) as Exclude<ColumnMapping, string>;

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

/** 3.x treated anything but a JSON array as empty and skipped non-string items, so the stored list says the same. */
const stringList = (to: string): ColumnMapping => ({
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

const postSetting = (column: string, fallback: string) => `COALESCE((SELECT ${quote(column)} FROM board_postconfig WHERE post_id = board_post.id), ${fallback})`;

/** Readers show an unreadable reservation as none, so it must not stop the import. */
function reservationDate(value: SQLInputValue): SQLInputValue {
  try {
    return legacyDate(value);
  } catch {
    return null;
  }
}

const grantsSiteSettings = `
  permission.codename = 'change_sitesetting' AND content_type.app_label = 'board' AND content_type.model = 'sitesetting'`;

/** Django granted this directly or through a group. Superusers pass by rule and need neither. */
const canManageSiteSettings = `
  EXISTS (
    SELECT 1 FROM auth_user_user_permissions AS direct
    JOIN auth_permission AS permission ON permission.id = direct.permission_id
    JOIN django_content_type AS content_type ON content_type.id = permission.content_type_id
    WHERE direct.user_id = auth_user.id AND ${grantsSiteSettings}
  ) OR EXISTS (
    SELECT 1 FROM auth_user_groups AS membership
    JOIN auth_group_permissions AS granted ON granted.group_id = membership.group_id
    JOIN auth_permission AS permission ON permission.id = granted.permission_id
    JOIN django_content_type AS content_type ON content_type.id = permission.content_type_id
    WHERE membership.user_id = auth_user.id AND ${grantsSiteSettings}
  )`;

/** 3.x reads a preference's oldest row, and only the text "true" turns it on. No row stays unset. */
const notifyPreference = (name: string, to: string): ColumnMapping => ({
  to,
  sql: `(SELECT value = 'true' FROM board_userconfigmeta WHERE user_id = preference.user_id AND name = '${name}' ORDER BY id LIMIT 1)`,
});

const tableMappings: Record<string, TableMapping> = {
  auth_user: {
    to: 'User',
    columns: {
      id: 'id', username: 'username', email: 'email', password: 'passwordHash', first_name: 'name',
      is_active: 'isActive', is_staff: 'isStaff', is_superuser: 'isSuperuser',
      can_manage_site_settings: { to: 'canManageSiteSettings', sql: canManageSiteSettings },
      last_login: date('lastLoginAt'), date_joined: date('joinedAt'),
    },
  },
  board_profile: {
    to: 'Profile',
    columns: {
      user_id: 'userId', role: choice('role', ['READER', 'EDITOR']), bio: 'bio', avatar: 'avatar', cover: 'cover', homepage: 'homepage',
      about_md: 'aboutMarkdown', about_html: 'aboutHtml',
    },
  },
  board_config: {
    to: 'UserPreference',
    // A 3.x account can have notification rows without a config row, and the reverse.
    from: '(SELECT user_id FROM board_config UNION SELECT user_id FROM board_userconfigmeta) AS preference',
    columns: {
      user_id: 'userId',
      language: { to: 'language', sql: '(SELECT language FROM board_config WHERE user_id = preference.user_id)' },
      time_zone: { to: 'timeZone', sql: `COALESCE((SELECT time_zone FROM board_config WHERE user_id = preference.user_id), '')` },
      notify_post_like: notifyPreference('NOTIFY_POSTS_LIKE', 'notifyPostLike'),
      notify_post_comment: notifyPreference('NOTIFY_POSTS_COMMENT', 'notifyPostComment'),
      notify_comment_like: notifyPreference('NOTIFY_COMMENT_LIKE', 'notifyCommentLike'),
      notify_mention: notifyPreference('NOTIFY_MENTION', 'notifyMention'),
    },
  },
  board_userlinkmeta: {
    to: 'SocialLink',
    columns: {
      id: 'id', user_id: 'userId', name: 'platform', value: 'url', order: int32('order'),
      created_date: date('createdAt'), updated_date: date('updatedAt'),
    },
  },
  board_socialauthprovider: {
    to: 'SocialProvider',
    columns: { id: 'id', key: 'key', client_id: 'clientId', client_secret: 'clientSecret', is_enabled: 'isEnabled' },
  },
  board_socialauth: {
    to: 'SocialAccount',
    columns: { id: 'id', provider_id: 'providerId', uid: 'uid', user_id: 'userId', extra_data: 'extraData', created_date: date('createdAt') },
  },
  board_twofactorauth: {
    to: 'TwoFactorAuth',
    columns: { id: 'id', user_id: 'userId', totp_secret: 'totpSecret', recovery_key: 'recoveryKey', created_date: date('createdAt') },
  },
  board_usernamechangelog: { to: 'UsernameChange', columns: { id: 'id', user_id: 'userId', username: 'username', created_date: date('createdAt') } },
  board_authorinvite: {
    to: 'AuthorInvite',
    columns: {
      id: 'id', code: 'code', note: 'note', is_active: 'isActive', created_by_id: 'createdById', claimed_by_id: 'claimedById',
      created_date: date('createdAt'), claimed_date: date('claimedAt'),
    },
  },
  board_loginattempt: { to: 'LoginAttempt', columns: { key: 'key', window: 'window', count: int32('count') } },
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
      id: 'id', user_id: 'userId', name: 'name', token_prefix: 'tokenPrefix', token_hash: 'tokenHash', scopes: stringList('scopes'),
      expires_at: date('expiresAt'), revoked_at: date('revokedAt'), last_used_at: date('lastUsedAt'), last_used_ip: 'lastUsedIp',
      created_date: date('createdAt'), updated_date: date('updatedAt'),
    },
  },
  board_series: {
    to: 'Series',
    columns: {
      id: 'id', owner_id: 'ownerId', url: 'slug', name: 'name', text_md: 'descriptionMarkdown', text_html: 'descriptionHtml',
      hide: 'isHidden', layout: 'layout', order: int32('order'), created_date: date('createdAt'), updated_date: date('updatedAt'),
    },
  },
  board_post: {
    to: 'Post',
    columns: {
      id: 'id', author_id: 'authorId', series_id: 'seriesId', url: 'slug', title: 'title', subtitle: 'subtitle', meta_description: 'description',
      image: 'image', image_hash: 'imageHash', read_time: int32('readTime'), created_date: date('createdAt'), updated_date: date('updatedAt'),
      published_date: date('publishedAt'), deleted_date: date('deletedAt'),
      is_hidden: { to: 'isHidden', sql: `${postSetting('hide', '0')} <> 0` },
      is_advertised: { to: 'isAdvertised', sql: `${postSetting('advertise', '0')} <> 0` },
      comments_blocked: { to: 'commentsBlocked', sql: `${postSetting('block_comment', '0')} <> 0` },
      cover_layout: { ...choiceColumn('coverLayout', ['default', 'split', 'overlay', 'none']), sql: postSetting('cover_layout', `'default'`) },
      cover_image_position: { ...choiceColumn('coverImagePosition', ['right', 'left']), sql: postSetting('cover_image_position', `'right'`) },
      cover_image_ratio: { to: 'coverImageRatio', sql: postSetting('cover_image_ratio', `'auto'`) },
      draft_reserved_date: {
        to: 'draftScheduledAt',
        sql: `(SELECT value FROM board_postconfigmeta WHERE post_id = board_post.id AND name = 'draft_reserved_date' ORDER BY id DESC LIMIT 1)`,
        convert: reservationDate,
      },
    },
  },
  board_postcontent: { to: 'PostContent', columns: { post_id: 'postId', content_html: 'html' } },
  board_tag: { to: 'Tag', columns: { id: 'id', value: 'name' } },
  board_post_tags: { to: '_PostToTag', columns: { post_id: 'A', tag_id: 'B' } },
  board_edithistory: {
    to: 'PostRevision',
    columns: {
      id: 'id', post_id: 'postId', actor_id: 'actorId', restored_from_id: 'restoredFromId',
      change_type: choice('type', ['edit', 'restore', 'legacy', 'draft']), title: 'title', subtitle: 'subtitle', description: 'description',
      content: 'content', content_excerpt: 'contentExcerpt', tags: stringList('tags'),
      source_updated_date: date('sourceUpdatedAt'), created_date: date('createdAt'),
    },
  },
  board_post_likes: { to: 'PostLike', columns: { post_id: 'postId', user_id: 'userId', created_date: date('createdAt') } },
  board_pinnedpost: { to: 'PinnedPost', columns: { user_id: 'userId', post_id: 'postId', order: int32('order'), created_date: date('createdAt') } },
  board_postsharelink: {
    to: 'PostShareLink',
    columns: { id: 'id', post_id: 'postId', token: 'token', label: 'label', is_paused: 'isPaused', created_date: date('createdAt') },
  },
  board_post_share_link_daily_counts: {
    to: 'PostShareDailyCount',
    columns: { link_id: 'linkId', day: date('day'), clicks: int32('clicks') },
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
  const read = source.prepare(`SELECT ${selected.join(', ')} FROM ${mapping?.from ?? quote(table)}${mapping?.where ? ` WHERE ${mapping.where}` : ''}`);
  read.setReadBigInts(true);
  const write = target.prepare(`INSERT INTO ${quote(destination)} (${names.map(quote).join(', ')}) VALUES (${names.map(() => '?').join(', ')})`);
  let copied = 0;
  for (const row of read.iterate() as Iterable<Record<string, SQLInputValue>>) {
    write.run(...columns.map((column, index) => {
      const output = outputs[index];
      return typeof output === 'string' || !output.convert ? row[column] : output.convert(row[column], `${table}.${column}`, row.id ?? row.user_id ?? row.key ?? null);
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
    target.prepare(`
      INSERT INTO "ScheduledPublication" (postId, publishAt)
      SELECT id, publishedAt FROM "Post" WHERE deletedAt IS NULL AND publishedAt > ?
    `).run(Date.now());

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
