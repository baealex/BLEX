import type { Prisma } from '@prisma/client';

export async function isLastAdministrator(tx: Prisma.TransactionClient, userId: number): Promise<boolean> {
  const superuser = await tx.user.findFirst({ where: { id: userId, isSuperuser: true }, select: { id: true } });
  if (!superuser) return false;
  const other = await tx.user.findFirst({ where: { id: { not: userId }, isSuperuser: true, isActive: true }, select: { id: true } });
  return other === null;
}

/** Schema cascades remove what the account owns and detach what outlives it, such as comments and invites. */
export async function deleteAccountRows(tx: Prisma.TransactionClient, userId: number) {
  await tx.user.deleteMany({ where: { id: userId } });
}
