import type { Prisma, PrismaClient } from '@prisma/client';
import type { FastifyRequest } from 'fastify';
import { randomBytes } from 'node:crypto';
import { containsLiteral } from '../../posts/data/text-match.js';
import { type AdminManagedUser, type AdminUserList, type AdminInvite } from '../types.js';
import { ApiResult, isoDate, positiveInteger } from '../shared.js';

const managedUserSelect = {
  id: true, username: true, name: true, email: true, isActive: true, isStaff: true, isSuperuser: true,
  joinedAt: true, lastLoginAt: true,
  profile: { select: { role: true } },
  _count: { select: { posts: { where: { deletedAt: null } } } },
} satisfies Prisma.UserSelect;

type ManagedUserRow = Prisma.UserGetPayload<{ select: typeof managedUserSelect }>;
type UserOrdering = { field: 'username' | 'postCount' | 'joinedAt'; direction: 'asc' | 'desc' };
type UserStats = AdminUserList['stats'];

export async function readInvites(db: PrismaClient): Promise<AdminInvite[]> {
  const rows = await db.authorInvite.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true, code: true, note: true, isActive: true, claimedById: true, createdAt: true, claimedAt: true,
      createdBy: { select: { username: true } },
      claimedBy: { select: { username: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    note: row.note,
    signupUrl: `/sign?invite=${row.code}`,
    isActive: row.isActive,
    isClaimed: row.claimedById !== null,
    createdBy: row.createdBy?.username ?? '',
    claimedBy: row.claimedBy?.username ?? '',
    createdDate: isoDate(row.createdAt),
    claimedDate: row.claimedAt ? isoDate(row.claimedAt) : null,
  }));
}

export function userListQuery(request: FastifyRequest): URLSearchParams {
  return new URL(request.url, 'https://blex.invalid').searchParams;
}

function managedUserWhere(query: string, role: string): Prisma.UserWhereInput {
  const conditions: Prisma.UserWhereInput[] = [];
  if (query) conditions.push({ OR: [{ username: { contains: query } }, { email: { contains: query } }, { name: { contains: query } }] });
  if (role === 'reader') conditions.push({ profile: { role: 'READER' } });
  else if (role === 'editor') conditions.push({ profile: { role: 'EDITOR' } });
  else if (role === 'admin') conditions.push({ OR: [{ isStaff: true }, { isSuperuser: true }] });
  return { AND: conditions };
}

function userRoleFilter(value: string | null): string {
  const role = value?.toLowerCase() ?? 'all';
  return ['all', 'reader', 'editor', 'admin'].includes(role) ? role : 'all';
}

function userOrdering(value: string | null): UserOrdering {
  switch (value) {
    case '-username': return { field: 'username', direction: 'desc' };
    case 'post_count': return { field: 'postCount', direction: 'asc' };
    case '-post_count': return { field: 'postCount', direction: 'desc' };
    case 'date_joined': return { field: 'joinedAt', direction: 'asc' };
    case '-date_joined': return { field: 'joinedAt', direction: 'desc' };
    default: return { field: 'username', direction: 'asc' };
  }
}

function compareManagedUsers({ field, direction }: UserOrdering) {
  const sign = direction === 'asc' ? 1 : -1;
  const byUsername = (left: ManagedUserRow, right: ManagedUserRow) => (left.username < right.username ? -1 : left.username > right.username ? 1 : 0);
  if (field === 'username') return (left: ManagedUserRow, right: ManagedUserRow) => sign * byUsername(left, right);
  const value = field === 'postCount'
    ? (row: ManagedUserRow) => row._count.posts
    : (row: ManagedUserRow) => row.joinedAt.getTime();
  return (left: ManagedUserRow, right: ManagedUserRow) => sign * (value(left) - value(right)) || byUsername(left, right);
}

function currentPage(requested: number, total: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return { page: Math.min(Math.max(requested, 1), totalPages), totalPages };
}

async function managedUserPage(
  db: PrismaClient,
  where: Prisma.UserWhereInput,
  query: string,
  ordering: UserOrdering,
  pageSize: number,
  requestedPage: number,
): Promise<{ users: ManagedUserRow[]; stats: UserStats; page: number; totalPages: number }> {
  // Prisma cannot sort by a filtered relation count, and `contains` is a LIKE that cannot escape % or _.
  if (ordering.field === 'postCount' || /[%_]/.test(query)) {
    const matches = (await db.user.findMany({ where, select: managedUserSelect }))
      .filter((user) => !query || [user.username, user.email, user.name].some((text) => containsLiteral(text, query)));
    const stats = {
      total: matches.length,
      editors: matches.filter((user) => user.profile?.role === 'EDITOR').length,
      readers: matches.filter((user) => user.profile?.role === 'READER').length,
      admins: matches.filter((user) => user.isStaff || user.isSuperuser).length,
    };
    const { page, totalPages } = currentPage(requestedPage, stats.total, pageSize);
    const users = matches.sort(compareManagedUsers(ordering)).slice((page - 1) * pageSize, page * pageSize);
    return { users, stats, page, totalPages };
  }
  const count = (extra: Prisma.UserWhereInput) => db.user.count({ where: { AND: [where, extra] } });
  const [total, editors, readers, admins] = await Promise.all([
    count({}),
    count({ profile: { role: 'EDITOR' } }),
    count({ profile: { role: 'READER' } }),
    count({ OR: [{ isStaff: true }, { isSuperuser: true }] }),
  ]);
  const { page, totalPages } = currentPage(requestedPage, total, pageSize);
  const orderBy: Prisma.UserOrderByWithRelationInput[] = ordering.field === 'joinedAt'
    ? [{ joinedAt: ordering.direction }, { username: 'asc' }]
    : [{ username: ordering.direction }];
  const users = await db.user.findMany({ where, orderBy, skip: (page - 1) * pageSize, take: pageSize, select: managedUserSelect });
  return { users, stats: { total, editors, readers, admins }, page, totalPages };
}

export async function readManagedUsers(db: PrismaClient, request: FastifyRequest): Promise<AdminUserList> {
  const params = userListQuery(request);
  const query = (params.get('q') ?? '').trim();
  const role = userRoleFilter(params.get('role'));
  const pageSizeValue = positiveInteger(params.get('page_size'), 20);
  const pageSize = pageSizeValue < 1 ? 20 : Math.min(pageSizeValue, 100);
  const requestedPage = positiveInteger(params.get('page'), 1);
  const { users, stats, page, totalPages } = await managedUserPage(
    db, managedUserWhere(query, role), query, userOrdering(params.get('ordering')), pageSize, requestedPage,
  );
  return {
    users: users.map((row) => ({
      id: row.id,
      username: row.username,
      name: row.name,
      email: row.email,
      role: row.profile?.role === 'EDITOR' ? 'EDITOR' : 'READER',
      isActive: row.isActive,
      isStaff: row.isStaff,
      isSuperuser: row.isSuperuser,
      canChangeRole: row.isActive && !row.isStaff && !row.isSuperuser,
      postCount: row._count.posts,
      dateJoined: isoDate(row.joinedAt),
      lastLogin: row.lastLoginAt ? isoDate(row.lastLoginAt) : null,
    })),
    pagination: {
      page,
      pageSize,
      total: stats.total,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    },
    stats,
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
    const target = await transaction.user.findUnique({
      where: { id: targetId },
      select: { id: true, username: true, name: true, email: true, isActive: true, isStaff: true, isSuperuser: true, joinedAt: true, lastLoginAt: true },
    });
    if (!target) return { ok: false, code: 'NF', message: 'User not found.' };
    if (target.id === actorId) return { ok: false, code: 'RJ', message: 'You cannot change your own role.' };
    if (target.isStaff || target.isSuperuser) {
      return { ok: false, code: 'RJ', message: 'Administrator roles cannot be changed from this page.' };
    }
    const profile = await transaction.profile.findUnique({ where: { userId: targetId }, select: { role: true } });
    if (profile) {
      await transaction.profile.update({ where: { userId: targetId }, data: { role: roleValue }, select: { userId: true } });
      if (profile.role === 'EDITOR' && roleValue === 'READER') {
        const now = new Date();
        await transaction.post.updateMany({
          where: { authorId: targetId, publishedAt: { gt: now } },
          data: { publishedAt: null, updatedAt: now },
        });
      }
    } else {
      await transaction.profile.create({ data: { userId: targetId, role: roleValue }, select: { userId: true } });
    }
    await transaction.userPreference.upsert({ where: { userId: targetId }, create: { userId: targetId }, update: {}, select: { userId: true } });
    const postCount = await transaction.post.count({ where: { authorId: targetId } });
    const user: AdminManagedUser = {
      id: target.id,
      username: target.username,
      name: target.name,
      email: target.email,
      role: roleValue,
      isActive: target.isActive,
      isStaff: target.isStaff,
      isSuperuser: target.isSuperuser,
      canChangeRole: target.isActive,
      postCount,
      dateJoined: isoDate(target.joinedAt),
      lastLogin: target.lastLoginAt ? isoDate(target.lastLoginAt) : null,
    };
    return { ok: true, body: user };
  });
}

export async function createInvite(db: PrismaClient, userId: number, noteInput: unknown): Promise<AdminInvite> {
  const note = typeof noteInput === 'string' ? noteInput.trim().slice(0, 120) : '';
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const code = randomBytes(12).toString('base64url');
    try {
      const invite = await db.authorInvite.create({
        data: { code, note, createdById: userId },
        select: { id: true, createdAt: true, createdBy: { select: { username: true } } },
      });
      return {
        id: invite.id,
        code,
        note,
        signupUrl: `/sign?invite=${code}`,
        isActive: true,
        isClaimed: false,
        createdBy: invite.createdBy?.username ?? '',
        claimedBy: '',
        createdDate: isoDate(invite.createdAt),
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
    const { count } = await transaction.authorInvite.deleteMany({ where: { id: inviteId, claimedById: null } });
    if (count > 0) return 'deleted';
    const row = await transaction.authorInvite.findUnique({ where: { id: inviteId }, select: { claimedById: true } });
    if (!row) return 'missing';
    return row.claimedById === null ? 'missing' : 'claimed';
  });
}

