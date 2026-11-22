import type { Prisma } from '@prisma/client';

export async function isLastAdministrator(tx: Prisma.TransactionClient, userId: number): Promise<boolean> {
  // The Django bool columns are still Unsupported in the Prisma model.
  const [last] = await tx.$queryRaw<Array<{ id: number }>>`
    SELECT id FROM auth_user WHERE id = ${userId} AND is_superuser = 1
      AND NOT EXISTS(SELECT 1 FROM auth_user WHERE id <> ${userId} AND is_superuser = 1 AND is_active = 1)
  `;
  return Boolean(last);
}

/** Remove owned records and anonymize records that survive the account. Schema cascades cover the rest. */
export async function deleteAccountRows(tx: Prisma.TransactionClient, userId: number) {
  const owned = { user_id: userId };
  const subscription = { OR: [{ subscriber_id: userId }, { author_id: userId }] };

  await tx.board_comment_likes.deleteMany({ where: owned });
  await tx.board_pinnedpost.deleteMany({ where: owned });
  await tx.board_post_likes.deleteMany({ where: owned });
  await tx.board_edithistory.updateMany({ where: { actor_id: userId }, data: { actor_id: null } });
  await tx.board_editrequest.deleteMany({ where: owned });
  await tx.board_webhooksubscription.deleteMany({ where: { board_profile: owned } });
  await tx.board_profile.deleteMany({ where: owned });
  await tx.board_authorsubscription.deleteMany({ where: subscription });
  await tx.board_authorsubscriptionlog.deleteMany({ where: subscription });
  await tx.board_developerrequestlog.deleteMany({ where: owned });
  await tx.board_developerrequestlog.updateMany({
    where: { board_developertoken: owned },
    data: { token_id: null },
  });
  await tx.board_developertoken.deleteMany({ where: owned });
  await tx.board_authorinvite.updateMany({ where: { created_by_id: userId }, data: { created_by_id: null } });
  await tx.board_authorinvite.updateMany({ where: { claimed_by_id: userId }, data: { claimed_by_id: null } });
  await tx.board_imagecache.updateMany({ where: owned, data: { user_id: null } });
  await tx.board_emailchange.deleteMany({ where: owned });
  await tx.board_userconfigmeta.deleteMany({ where: owned });
  await tx.board_config.deleteMany({ where: owned });
  await tx.board_userlinkmeta.deleteMany({ where: owned });
  await tx.board_twofactorauth.deleteMany({ where: owned });
  await tx.usernameChange.deleteMany({ where: { userId } });
  await tx.board_socialauth.deleteMany({ where: owned });
  await tx.board_notify.deleteMany({ where: owned });
  await tx.board_telegramsync.deleteMany({ where: owned });
  await tx.board_utilitycleanupconfirmation.deleteMany({ where: owned });
  await tx.django_admin_log.deleteMany({ where: owned });
  await tx.auth_user_groups.deleteMany({ where: owned });
  await tx.auth_user_user_permissions.deleteMany({ where: owned });
  await tx.user.deleteMany({ where: { id: userId } });
}
