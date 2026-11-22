import type { PrismaClient } from '@prisma/client';

export interface UserAccess {
  active: boolean;
  staff: boolean;
  superuser: boolean;
  canManageSiteSettings: boolean;
}

export async function readAdminAccess(db: PrismaClient, userId: number): Promise<UserAccess | null> {
  const [row] = await db.$queryRaw<Array<{
    active: number | bigint | boolean;
    staff: number | bigint | boolean;
    superuser: number | bigint | boolean;
    canManageSiteSettings: number | bigint | boolean;
  }>>`
    SELECT user.is_active AS active, user.is_staff AS staff, user.is_superuser AS superuser,
      EXISTS (
        SELECT 1 FROM auth_user_user_permissions AS direct_permission
        JOIN auth_permission AS permission ON permission.id = direct_permission.permission_id
        JOIN django_content_type AS content_type ON content_type.id = permission.content_type_id
        WHERE direct_permission.user_id = user.id
          AND permission.codename = 'change_sitesetting'
          AND content_type.app_label = 'board' AND content_type.model = 'sitesetting'
      ) OR EXISTS (
        SELECT 1 FROM auth_user_groups AS user_group
        JOIN auth_group_permissions AS group_permission ON group_permission.group_id = user_group.group_id
        JOIN auth_permission AS permission ON permission.id = group_permission.permission_id
        JOIN django_content_type AS content_type ON content_type.id = permission.content_type_id
        WHERE user_group.user_id = user.id
          AND permission.codename = 'change_sitesetting'
          AND content_type.app_label = 'board' AND content_type.model = 'sitesetting'
      ) AS canManageSiteSettings
    FROM auth_user AS user WHERE user.id = ${userId} LIMIT 1
  `;
  if (!row) return null;
  return {
    active: Boolean(row.active),
    staff: Boolean(row.staff),
    superuser: Boolean(row.superuser),
    canManageSiteSettings: Boolean(row.superuser) || Boolean(row.canManageSiteSettings),
  };
}

