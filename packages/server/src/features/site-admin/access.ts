import type { PrismaClient } from '@prisma/client';

export interface UserAccess {
  active: boolean;
  staff: boolean;
  superuser: boolean;
  canManageSiteSettings: boolean;
}

export async function readAdminAccess(db: PrismaClient, userId: number): Promise<UserAccess | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { isActive: true, isStaff: true, isSuperuser: true, canManageSiteSettings: true },
  });
  if (!user) return null;
  return {
    active: user.isActive,
    staff: user.isStaff,
    superuser: user.isSuperuser,
    canManageSiteSettings: user.isSuperuser || user.canManageSiteSettings,
  };
}
