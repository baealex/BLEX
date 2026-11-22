import type { PrismaClient } from '@prisma/client';
import { readPublicSiteBrand } from '../public-pages/index.js';

/** The brand and signed-in header state shared by standalone server-rendered pages. */
export async function readPageChrome(db: PrismaClient, user: { id: number; username: string } | null, csrfToken: string) {
  const brand = await readPublicSiteBrand(db);
  if (!user) return { brand };
  const [row] = await db.$queryRaw<Array<{ role: string | null; staff: number | bigint | boolean | null; unread: number | bigint }>>`
    SELECT (SELECT role FROM board_profile WHERE user_id = ${user.id} LIMIT 1) AS role,
           (SELECT is_staff FROM auth_user WHERE id = ${user.id}) AS staff,
           (SELECT COUNT(*) FROM board_notify WHERE user_id = ${user.id} AND has_read = 0) AS unread
  `;
  return { brand, viewer: {
    username: user.username, hasEditorRole: row?.role === 'EDITOR', isStaff: Boolean(Number(row?.staff ?? 0)),
    unreadCount: Number(row?.unread ?? 0), csrfToken,
  } };
}
