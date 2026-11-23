import type { Prisma, PrismaClient } from '@prisma/client';
import { deletePosts } from '../posts/services/deletions.js';
import { removeAttachment } from '../work-logs/services/attachments.js';
import { deleteWorkLogs } from '../work-logs/services/deletions.js';
import { deleteAccountRows, isLastAdministrator } from './services/deletions.js';
import { acquireVerification, type VerificationAccount } from './verification.js';

/** Removes everything the account owns. Call `removeAccountAttachments` with the result after the transaction commits. */
export async function removeAccountData(tx: Prisma.TransactionClient, userId: number) {
  const attachments = await deleteWorkLogs(tx, { ownerId: userId });
  await deletePosts(tx, { authorId: userId });
  await deleteAccountRows(tx, userId);
  return attachments;
}

export async function removeAccountAttachments(
  attachments: Awaited<ReturnType<typeof removeAccountData>>,
  mediaRoot?: string,
) {
  for (const { attachment } of attachments) await removeAttachment(mediaRoot, attachment);
}

export async function deleteAccount(db: PrismaClient, account: VerificationAccount, mediaRoot?: string) {
  const result = await db.$transaction(
    async (tx) => {
      if (!(await acquireVerification(tx, account))) return { error: 'RE' } as const;
      if (await isLastAdministrator(tx, account.id)) return { error: 'RJ' } as const;

      const setting = await tx.loginSetting.findUnique({
        where: { id: 1 },
        select: { accountDeletionRedirectUrl: true },
      });
      const attachments = await removeAccountData(tx, account.id);
      return { attachments, url: setting?.accountDeletionRedirectUrl ?? '' } as const;
    },
    { timeout: 15_000, isolationLevel: 'Serializable' },
  );
  if (!result.error) await removeAccountAttachments(result.attachments, mediaRoot);
  return result;
}
