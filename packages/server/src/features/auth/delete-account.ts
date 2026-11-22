import { Prisma, type PrismaClient } from '@prisma/client';
import { removeAttachment } from '../work-logs/index.js';
import { acquireVerification, type VerificationAccount } from './verification.js';

export async function deleteAccount(db: PrismaClient, account: VerificationAccount, mediaRoot?: string) {
  const user = account.id;
  const posts = Prisma.sql`SELECT id FROM board_post WHERE author_id = ${user}`;
  const logs = Prisma.sql`SELECT id FROM board_worklog WHERE owner_id = ${user}`;
  const entries = Prisma.sql`SELECT id FROM board_worklogentry WHERE log_id IN (${logs})`;
  const shares = Prisma.sql`SELECT id FROM board_worklogshare WHERE log_id IN (${logs})`;
  const comments = Prisma.sql`
    WITH RECURSIVE thread(id) AS (
      SELECT id FROM board_comment WHERE post_id IN (${posts})
      UNION SELECT child.id FROM board_comment AS child JOIN thread ON child.parent_id = thread.id
    ) SELECT id FROM thread
  `;
  const series = Prisma.sql`SELECT id FROM board_series WHERE owner_id = ${user}`;

  const result = await db.$transaction(async (tx) => {
    if (!await acquireVerification(tx, account)) return { error: 'RE' } as const;
    const [last] = await tx.$queryRaw<unknown[]>`
      SELECT 1 FROM auth_user WHERE id = ${user} AND is_superuser = 1
        AND NOT EXISTS(SELECT 1 FROM auth_user WHERE id <> ${user} AND is_superuser = 1 AND is_active = 1)
    `;
    if (last) return { error: 'RJ' } as const;

    const attachments = await tx.$queryRaw<Array<{ attachment: string }>>`
      SELECT attachment FROM board_worklogentry WHERE id IN (${entries}) AND attachment <> ''
    `;
    const [setting] = await tx.$queryRaw<Array<{ url: string }>>`
      SELECT account_deletion_redirect_url AS url FROM board_loginsetting WHERE id = 1
    `;

    // Django applied these CASCADE and SET_NULL policies in its ORM. SQLite
    // preserves the old tables and deferrable foreign keys during the handoff.
    const changes = [
      Prisma.sql`DELETE FROM board_worklogshare_entries WHERE worklogshare_id IN (${shares}) OR worklogentry_id IN (${entries})`,
      Prisma.sql`DELETE FROM board_worklogshare WHERE log_id IN (${logs})`,
      Prisma.sql`DELETE FROM board_worklogentry WHERE log_id IN (${logs})`,
      Prisma.sql`DELETE FROM board_worklog WHERE owner_id = ${user}`,
      Prisma.sql`DELETE FROM board_post_share_link_daily_counts WHERE link_id IN (SELECT id FROM board_postsharelink WHERE post_id IN (${posts}))`,
      Prisma.sql`DELETE FROM board_postsharelink WHERE post_id IN (${posts})`,
      Prisma.sql`DELETE FROM board_comment_likes WHERE user_id = ${user} OR comment_id IN (${comments})`,
      Prisma.sql`DELETE FROM board_comment WHERE id IN (${comments})`,
      Prisma.sql`UPDATE board_comment SET author_id = NULL WHERE author_id = ${user}`,
      Prisma.sql`DELETE FROM board_postcontent WHERE post_id IN (${posts})`,
      Prisma.sql`DELETE FROM board_postconfig WHERE post_id IN (${posts})`,
      Prisma.sql`DELETE FROM board_postconfigmeta WHERE post_id IN (${posts})`,
      Prisma.sql`DELETE FROM board_post_tags WHERE post_id IN (${posts})`,
      Prisma.sql`DELETE FROM board_pinnedpost WHERE user_id = ${user} OR post_id IN (${posts})`,
      Prisma.sql`DELETE FROM board_post_likes WHERE user_id = ${user} OR post_id IN (${posts})`,
      Prisma.sql`UPDATE board_edithistory SET restored_from_id = NULL
        WHERE restored_from_id IN (SELECT id FROM board_edithistory WHERE post_id IN (${posts}))`,
      Prisma.sql`DELETE FROM board_edithistory WHERE post_id IN (${posts})`,
      Prisma.sql`UPDATE board_edithistory SET actor_id = NULL WHERE actor_id = ${user}`,
      Prisma.sql`DELETE FROM board_editrequest WHERE user_id = ${user} OR post_id IN (${posts})`,
      Prisma.sql`DELETE FROM board_post WHERE author_id = ${user}`,
      Prisma.sql`UPDATE board_post SET series_id = NULL WHERE series_id IN (${series})`,
      Prisma.sql`DELETE FROM board_seriesconfigmeta WHERE post_id IN (${series})`,
      Prisma.sql`DELETE FROM board_series WHERE owner_id = ${user}`,
      Prisma.sql`DELETE FROM board_webhooksubscription WHERE author_id IN (SELECT id FROM board_profile WHERE user_id = ${user})`,
      Prisma.sql`DELETE FROM board_profile WHERE user_id = ${user}`,
      Prisma.sql`DELETE FROM board_authorsubscription WHERE subscriber_id = ${user} OR author_id = ${user}`,
      Prisma.sql`DELETE FROM board_authorsubscriptionlog WHERE subscriber_id = ${user} OR author_id = ${user}`,
      Prisma.sql`DELETE FROM board_developerrequestlog WHERE user_id = ${user}`,
      Prisma.sql`UPDATE board_developerrequestlog SET token_id = NULL
        WHERE token_id IN (SELECT id FROM board_developertoken WHERE user_id = ${user})`,
      Prisma.sql`DELETE FROM board_developertoken WHERE user_id = ${user}`,
      Prisma.sql`UPDATE board_authorinvite SET created_by_id = NULL WHERE created_by_id = ${user}`,
      Prisma.sql`UPDATE board_authorinvite SET claimed_by_id = NULL WHERE claimed_by_id = ${user}`,
      Prisma.sql`UPDATE board_staticpage SET author_id = NULL WHERE author_id = ${user}`,
      Prisma.sql`UPDATE board_imagecache SET user_id = NULL WHERE user_id = ${user}`,
      Prisma.sql`DELETE FROM board_form WHERE user_id = ${user}`,
      Prisma.sql`DELETE FROM board_emailchange WHERE user_id = ${user}`,
      Prisma.sql`DELETE FROM board_userconfigmeta WHERE user_id = ${user}`,
      Prisma.sql`DELETE FROM board_config WHERE user_id = ${user}`,
      Prisma.sql`DELETE FROM board_userlinkmeta WHERE user_id = ${user}`,
      Prisma.sql`DELETE FROM board_twofactorauth WHERE user_id = ${user}`,
      Prisma.sql`DELETE FROM board_usernamechangelog WHERE user_id = ${user}`,
      Prisma.sql`DELETE FROM board_socialauth WHERE user_id = ${user}`,
      Prisma.sql`DELETE FROM board_notify WHERE user_id = ${user}`,
      Prisma.sql`DELETE FROM board_telegramsync WHERE user_id = ${user}`,
      Prisma.sql`DELETE FROM board_utilitycleanupconfirmation WHERE user_id = ${user}`,
      Prisma.sql`DELETE FROM board_sitenotice WHERE user_id = ${user}`,
      Prisma.sql`DELETE FROM board_sitebanner WHERE user_id = ${user}`,
      Prisma.sql`DELETE FROM django_admin_log WHERE user_id = ${user}`,
      Prisma.sql`DELETE FROM auth_user_groups WHERE user_id = ${user}`,
      Prisma.sql`DELETE FROM auth_user_user_permissions WHERE user_id = ${user}`,
      Prisma.sql`DELETE FROM auth_user WHERE id = ${user}`,
    ];
    for (const command of changes) await tx.$executeRaw(command);
    return { attachments, url: setting?.url ?? '' } as const;
  }, { timeout: 15_000 });
  if (!result.error) for (const { attachment } of result.attachments) await removeAttachment(mediaRoot, attachment);
  return result;
}
