import { Prisma, type PrismaClient } from '@prisma/client';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { randomBytes } from 'node:crypto';
import { adminSettingsCapabilities, type UserAccess } from '../access.js';
import { renderAdminInvites, type AdminManagedUser, type AdminUserList, type AdminInvite, type AdminSettingsUser } from '../pages.js';
import { ApiResult, booleanValue, csrfToken, djangoTimestamp, isoDate, pageNumber, positiveInteger } from '../shared.js';

interface InviteRow {
  id: number;
  code: string;
  note: string;
  isActive: number | bigint | boolean;
  createdBy: string | null;
  claimedBy: string | null;
  createdDate: string | null;
  claimedDate: string | null;
  claimedById: number | null;
}

interface ManagedUserRow {
  id: number;
  username: string;
  name: string;
  email: string;
  isActive: number | bigint | boolean;
  isStaff: number | bigint | boolean;
  isSuperuser: number | bigint | boolean;
  role: string | null;
  postCount: number | bigint;
  dateJoined: string | null;
  lastLogin: string | null;
}

export async function readInvites(db: PrismaClient): Promise<AdminInvite[]> {
  const rows = await db.$queryRaw<InviteRow[]>`
    SELECT invite.id, invite.code, invite.note, invite.is_active AS isActive,
           creator.username AS createdBy, claimer.username AS claimedBy,
           CAST(invite.created_date AS TEXT) AS createdDate,
           CAST(invite.claimed_date AS TEXT) AS claimedDate, invite.claimed_by_id AS claimedById
      FROM board_authorinvite AS invite
      LEFT JOIN auth_user AS creator ON creator.id = invite.created_by_id
      LEFT JOIN auth_user AS claimer ON claimer.id = invite.claimed_by_id
     ORDER BY invite.created_date DESC LIMIT 20
  `;
  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    note: row.note,
    signupUrl: `/sign?invite=${row.code}`,
    isActive: booleanValue(row.isActive),
    isClaimed: row.claimedById !== null,
    createdBy: row.createdBy ?? '',
    claimedBy: row.claimedBy ?? '',
    createdDate: row.createdDate ? isoDate(row.createdDate) : null,
    claimedDate: row.claimedDate ? isoDate(row.claimedDate) : null,
  }));
}

export function userListQuery(request: FastifyRequest): URLSearchParams {
  return new URL(request.url, 'https://blex.invalid').searchParams;
}

function managedUserWhere(query: string, role: string): Prisma.Sql[] {
  const where: Prisma.Sql[] = [];
  if (query) {
    where.push(Prisma.sql`(
      instr(lower(user.username), lower(${query})) > 0 OR
      instr(lower(user.email), lower(${query})) > 0 OR
      instr(lower(user.first_name), lower(${query})) > 0
    )`);
  }
  if (role === 'reader') where.push(Prisma.sql`profile.role = 'READER'`);
  else if (role === 'editor') where.push(Prisma.sql`profile.role = 'EDITOR'`);
  else if (role === 'admin') where.push(Prisma.sql`(user.is_staff = 1 OR user.is_superuser = 1)`);
  return where;
}

function userRoleFilter(value: string | null): string {
  const role = value?.toLowerCase() ?? 'all';
  return ['all', 'reader', 'editor', 'admin'].includes(role) ? role : 'all';
}

function userOrdering(value: string | null): Prisma.Sql {
  switch (value) {
    case '-username': return Prisma.sql`user.username DESC, user.username ASC`;
    case 'post_count': return Prisma.sql`postCount ASC, user.username ASC`;
    case '-post_count': return Prisma.sql`postCount DESC, user.username ASC`;
    case 'date_joined': return Prisma.sql`user.date_joined ASC, user.username ASC`;
    case '-date_joined': return Prisma.sql`user.date_joined DESC, user.username ASC`;
    default: return Prisma.sql`user.username ASC`;
  }
}

export async function readManagedUsers(db: PrismaClient, request: FastifyRequest): Promise<AdminUserList> {
  const params = userListQuery(request);
  const query = (params.get('q') ?? '').trim();
  const role = userRoleFilter(params.get('role'));
  const where = managedUserWhere(query, role);
  const clause = where.length ? Prisma.sql`WHERE ${Prisma.join(where, ' AND ')}` : Prisma.empty;
  const [counts] = await db.$queryRaw<Array<{ total: number | bigint; editors: number | bigint; readers: number | bigint; admins: number | bigint }>>(Prisma.sql`
    SELECT COUNT(*) AS total,
      SUM(CASE WHEN profile.role = 'EDITOR' THEN 1 ELSE 0 END) AS editors,
      SUM(CASE WHEN profile.role = 'READER' THEN 1 ELSE 0 END) AS readers,
      SUM(CASE WHEN user.is_staff = 1 OR user.is_superuser = 1 THEN 1 ELSE 0 END) AS admins
    FROM auth_user AS user LEFT JOIN board_profile AS profile ON profile.user_id = user.id
    ${clause}
  `);
  const total = Number(counts?.total ?? 0);
  const pageSizeValue = positiveInteger(params.get('page_size'), 20);
  const pageSize = pageSizeValue < 1 ? 20 : Math.min(pageSizeValue, 100);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const requestedPage = positiveInteger(params.get('page'), 1);
  const page = Math.min(Math.max(requestedPage, 1), totalPages);
  const ordering = userOrdering(params.get('ordering'));
  const rows = await db.$queryRaw<ManagedUserRow[]>(Prisma.sql`
    SELECT user.id, user.username, user.first_name AS name, user.email,
      user.is_active AS isActive, user.is_staff AS isStaff, user.is_superuser AS isSuperuser,
      profile.role AS role,
      (SELECT COUNT(*) FROM board_post AS post WHERE post.author_id = user.id AND post.deleted_date IS NULL) AS postCount,
      CAST(user.date_joined AS TEXT) AS dateJoined, CAST(user.last_login AS TEXT) AS lastLogin
    FROM auth_user AS user LEFT JOIN board_profile AS profile ON profile.user_id = user.id
    ${clause}
    ORDER BY ${ordering}
    LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
  `);
  return {
    users: rows.map((row) => ({
      id: Number(row.id),
      username: row.username,
      name: row.name,
      email: row.email,
      role: row.role === 'EDITOR' ? 'EDITOR' : 'READER',
      isActive: booleanValue(row.isActive),
      isStaff: booleanValue(row.isStaff),
      isSuperuser: booleanValue(row.isSuperuser),
      canChangeRole: booleanValue(row.isActive) && !booleanValue(row.isStaff) && !booleanValue(row.isSuperuser),
      postCount: Number(row.postCount),
      dateJoined: row.dateJoined ? isoDate(row.dateJoined) : null,
      lastLogin: row.lastLogin ? isoDate(row.lastLogin) : null,
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    },
    stats: {
      total,
      editors: Number(counts?.editors ?? 0),
      readers: Number(counts?.readers ?? 0),
      admins: Number(counts?.admins ?? 0),
    },
  };
}

export function managedUserApi(user: AdminManagedUser): Record<string, unknown> {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    role: user.role,
    is_active: user.isActive,
    is_staff: user.isStaff,
    is_superuser: user.isSuperuser,
    can_change_role: user.canChangeRole,
    post_count: user.postCount,
    date_joined: user.dateJoined,
    last_login: user.lastLogin,
  };
}

export function managedUserListApi(list: AdminUserList): Record<string, unknown> {
  return {
    users: list.users.map(managedUserApi),
    pagination: {
      page: list.pagination.page,
      page_size: list.pagination.pageSize,
      total: list.pagination.total,
      total_pages: list.pagination.totalPages,
      has_next: list.pagination.hasNext,
      has_previous: list.pagination.hasPrevious,
    },
    stats: list.stats,
  };
}

export async function updateManagedUserRole(
  db: PrismaClient,
  actorId: number,
  targetId: number,
  roleValue: unknown,
): Promise<ApiResult<AdminManagedUser>> {
  if (roleValue !== 'READER' && roleValue !== 'EDITOR') {
    return { ok: false, code: 'RJ', message: 'This role is not supported.' };
  }
  return db.$transaction(async (transaction) => {
    const [target] = await transaction.$queryRaw<Array<{
      id: number;
      username: string;
      name: string;
      email: string;
      isActive: number | bigint | boolean;
      isStaff: number | bigint | boolean;
      isSuperuser: number | bigint | boolean;
      dateJoined: string | null;
      lastLogin: string | null;
    }>>`
      SELECT id, username, first_name AS name, email, is_active AS isActive,
        is_staff AS isStaff, is_superuser AS isSuperuser,
        CAST(date_joined AS TEXT) AS dateJoined, CAST(last_login AS TEXT) AS lastLogin
      FROM auth_user WHERE id = ${targetId} LIMIT 1
    `;
    if (!target) return { ok: false, code: 'NF', message: 'User not found.' };
    if (target.id === actorId) return { ok: false, code: 'RJ', message: 'You cannot change your own role.' };
    if (booleanValue(target.isStaff) || booleanValue(target.isSuperuser)) {
      return { ok: false, code: 'RJ', message: 'Administrator roles cannot be changed from this page.' };
    }
    const [profile] = await transaction.$queryRaw<Array<{ id: number; role: string }>>`
      SELECT id, role FROM board_profile WHERE user_id = ${targetId} LIMIT 1
    `;
    if (profile) {
      await transaction.$executeRaw`UPDATE board_profile SET role = ${roleValue} WHERE id = ${profile.id}`;
      if (profile.role === 'EDITOR' && roleValue === 'READER') {
        const timestamp = djangoTimestamp();
        await transaction.$executeRaw`
          UPDATE board_post SET published_date = NULL, updated_date = ${timestamp}
          WHERE author_id = ${targetId} AND published_date > ${timestamp}
        `;
      }
    } else {
      await transaction.$executeRaw`
        INSERT INTO board_profile (bio, cover, avatar, homepage, about_md, about_html, user_id, analytics_share_url, role)
        VALUES ('', '', '', '', '', '', ${targetId}, '', ${roleValue})
      `;
    }
    await transaction.$executeRaw`
      INSERT INTO board_config (user_id, language, time_zone) VALUES (${targetId}, NULL, '')
      ON CONFLICT(user_id) DO NOTHING
    `;
    const [postCount] = await transaction.$queryRaw<Array<{ postCount: number | bigint }>>`
      SELECT COUNT(*) AS postCount FROM board_post WHERE author_id = ${targetId}
    `;
    const user: AdminManagedUser = {
      id: Number(target.id),
      username: target.username,
      name: target.name,
      email: target.email,
      role: roleValue,
      isActive: booleanValue(target.isActive),
      isStaff: booleanValue(target.isStaff),
      isSuperuser: booleanValue(target.isSuperuser),
      canChangeRole: booleanValue(target.isActive),
      postCount: Number(postCount?.postCount ?? 0),
      dateJoined: target.dateJoined ? isoDate(target.dateJoined) : null,
      lastLogin: target.lastLogin ? isoDate(target.lastLogin) : null,
    };
    return { ok: true, body: user };
  });
}

export async function createInvite(db: PrismaClient, userId: number, noteInput: unknown): Promise<AdminInvite> {
  const note = typeof noteInput === 'string' ? noteInput.trim().slice(0, 120) : '';
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const code = randomBytes(12).toString('base64url');
    try {
      const id = await db.$transaction(async (transaction) => {
        await transaction.$executeRaw`
          INSERT INTO board_authorinvite (code, note, is_active, created_date, claimed_date, claimed_by_id, created_by_id)
          VALUES (${code}, ${note}, 1, ${djangoTimestamp()}, NULL, NULL, ${userId})
        `;
        const [row] = await transaction.$queryRaw<Array<{ id: number }>>`SELECT last_insert_rowid() AS id`;
        return Number(row?.id ?? 0);
      });
      const [creator] = await db.$queryRaw<Array<{ username: string }>>`SELECT username FROM auth_user WHERE id = ${userId} LIMIT 1`;
      return {
        id,
        code,
        note,
        signupUrl: `/sign?invite=${code}`,
        isActive: true,
        isClaimed: false,
        createdBy: creator?.username ?? '',
        claimedBy: '',
        createdDate: isoDate(djangoTimestamp()),
        claimedDate: null,
      };
    } catch (error) {
      if (attempt === 2) throw error;
    }
  }
  throw new Error('Could not create an invitation link.');
}

export async function deleteInvite(db: PrismaClient, inviteId: number): Promise<'deleted' | 'claimed' | 'missing'> {
  return db.$transaction(async (transaction) => {
    const deleted = await transaction.$executeRaw`
      DELETE FROM board_authorinvite WHERE id = ${inviteId} AND claimed_by_id IS NULL
    `;
    if (deleted > 0) return 'deleted';
    const [row] = await transaction.$queryRaw<Array<{ claimedById: number | null }>>`
      SELECT claimed_by_id AS claimedById FROM board_authorinvite WHERE id = ${inviteId} LIMIT 1
    `;
    if (!row) return 'missing';
    return row.claimedById === null ? 'missing' : 'claimed';
  });
}

export async function pageInvites(
  request: FastifyRequest,
  reply: FastifyReply,
  db: PrismaClient,
  user: AdminSettingsUser,
  access: UserAccess,
  error?: string,
) {
  const params = userListQuery(request);
  return reply.type('text/html; charset=utf-8').send(renderAdminInvites({
    user,
    capabilities: adminSettingsCapabilities(access),
    invites: await readInvites(db),
    managedUsers: await readManagedUsers(db, request),
    query: params.get('q') ?? '',
    roleFilter: userRoleFilter(params.get('role')),
    csrfToken: csrfToken(request),
    saved: !error && pageNumber(request).get('saved') === '1',
    error,
  }));
}
