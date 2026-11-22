import type { PrismaClient } from '@prisma/client';
import { deleteSeriesRows } from '../series/services/deletions.js';
import { deletePosts } from '../posts/services/deletions.js';
import { anonymizeComments } from '../engagement/services/deletions.js';
import { removeAttachment } from '../work-logs/services/attachments.js';
import { deleteWorkLogs } from '../work-logs/services/deletions.js';
import { deleteAccountRows, isLastAdministrator } from './services/deletions.js';
import { acquireVerification, type VerificationAccount } from './verification.js';

export async function deleteAccount(db: PrismaClient, account: VerificationAccount, mediaRoot?: string) {
  const result = await db.$transaction(async (tx) => {
    if (!await acquireVerification(tx, account)) return { error: 'RE' } as const;
    if (await isLastAdministrator(tx, account.id)) return { error: 'RJ' } as const;

    const setting = await tx.board_loginsetting.findUnique({
      where: { id: 1 },
      select: { account_deletion_redirect_url: true },
    });
    const attachments = await deleteWorkLogs(tx, { ownerId: account.id });
    await deletePosts(tx, { authorId: account.id });
    await deleteSeriesRows(tx, { owner_id: account.id });
    await anonymizeComments(tx, account.id);
    await deleteAccountRows(tx, account.id);
    return { attachments, url: setting?.account_deletion_redirect_url ?? '' } as const;
  }, { timeout: 15_000, isolationLevel: 'Serializable' });
  if (!result.error) for (const { attachment } of result.attachments) await removeAttachment(mediaRoot, attachment);
  return result;
}
