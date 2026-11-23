import type { PrismaClient } from '@prisma/client';
import { readPublicSiteBrand } from '../features/discovery/http/pages.js';

/** The brand and signed-in header state shared by standalone server-rendered pages. */
export async function readPageChrome(
  db: PrismaClient,
  user: { id: number; username: string } | null,
  csrfToken: string,
) {
  const brand = await readPublicSiteBrand(db);
  if (!user) return { brand };
  const row = await db.user.findUnique({
    where: { id: user.id },
    select: { isStaff: true, profile: { select: { role: true } } },
  });
  const unreadCount = await db.notification.count({ where: { userId: user.id, isRead: false } });
  return {
    brand,
    viewer: {
      username: user.username,
      hasEditorRole: row?.profile?.role === 'EDITOR',
      isStaff: row?.isStaff ?? false,
      unreadCount,
      csrfToken,
    },
  };
}
