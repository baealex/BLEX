import type { Prisma, PrismaClient } from '@prisma/client';
import type { FastifyRequest } from 'fastify';
import { randomBytes } from 'node:crypto';
import { containsLiteral } from '../../posts/data/text-match.js';
import { removeAccountAttachments, removeAccountData } from '../../auth/delete-account.js';
import { createPasswordResetToken } from '../../auth/password-reset.js';
import { type AdminManagedUser, type AdminUserList, type AdminInvite } from '../types.js';
import { ApiResult, isoDate, positiveInteger, recordModeration } from '../shared.js';

/** Posts in the trash do not count toward a member's post total. */
const countedPosts = { deletedAt: null } satisfies Prisma.PostWhereInput;

const managedUserSelect = {
  id: true,
  username: true,
  name: true,
  email: true,
  isActive: true,
  isStaff: true,
  isSuperuser: true,
  joinedAt: true,
  lastLoginAt: true,
  profile: { select: { role: true } },
  twoFactor: { select: { id: true } },
  _count: { select: { posts: { where: countedPosts } } },
} satisfies Prisma.UserSelect;

type ManagedUserRow = Prisma.UserGetPayload<{ select: typeof managedUserSelect }>;
type UserOrdering = { field: 'username' | 'postCount' | 'joinedAt'; direction: 'asc' | 'desc' };
type UserStats = AdminUserList['stats'];

export interface MemberActor {
  id: number;
  superuser: boolean;
}

/**
 * Staff can suspend members. Deleting an account, or handing out a way into one, takes a superuser,
 * and no one can use these on their own account or on another superuser.
 */
function memberPermissions(row: ManagedUserRow, actor: MemberActor) {
  const administrator = row.isStaff || row.isSuperuser;
  const self = row.id === actor.id;
  const recoverable = actor.superuser && !self && !row.isSuperuser;
  return {
    canChangeRole: row.isActive && !administrator,
    canChangeStatus: !self && !administrator,
    canDelete: actor.superuser && !self && !administrator,
    canResetPassword: recoverable && row.isActive,
    canResetTwoFactor: recoverable && row.twoFactor !== null,
  };
}

function managedUser(row: ManagedUserRow, actor: MemberActor): AdminManagedUser {
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    email: row.email,
    role: row.profile?.role === 'EDITOR' ? 'EDITOR' : 'READER',
    isActive: row.isActive,
    isStaff: row.isStaff,
    isSuperuser: row.isSuperuser,
    hasTwoFactor: row.twoFactor !== null,
    ...memberPermissions(row, actor),
    postCount: row._count.posts,
    dateJoined: isoDate(row.joinedAt),
    lastLogin: row.lastLoginAt ? isoDate(row.lastLoginAt) : null,
  };
}

export async function readInvites(db: PrismaClient): Promise<AdminInvite[]> {
  const rows = await db.authorInvite.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      code: true,
      note: true,
      isActive: true,
      claimedById: true,
      createdAt: true,
      claimedAt: true,
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
  if (query)
    conditions.push({
      OR: [{ username: { contains: query } }, { email: { contains: query } }, { name: { contains: query } }],
    });
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
    case '-username':
      return { field: 'username', direction: 'desc' };
    case 'postCount':
      return { field: 'postCount', direction: 'asc' };
    case '-postCount':
      return { field: 'postCount', direction: 'desc' };
    case 'dateJoined':
      return { field: 'joinedAt', direction: 'asc' };
    case '-dateJoined':
      return { field: 'joinedAt', direction: 'desc' };
    default:
      return { field: 'username', direction: 'asc' };
  }
}

function compareManagedUsers({ field, direction }: UserOrdering) {
  const sign = direction === 'asc' ? 1 : -1;
  const byUsername = (left: ManagedUserRow, right: ManagedUserRow) =>
    left.username < right.username ? -1 : left.username > right.username ? 1 : 0;
  if (field === 'username') return (left: ManagedUserRow, right: ManagedUserRow) => sign * byUsername(left, right);
  const value =
    field === 'postCount' ? (row: ManagedUserRow) => row._count.posts : (row: ManagedUserRow) => row.joinedAt.getTime();
  return (left: ManagedUserRow, right: ManagedUserRow) =>
    sign * (value(left) - value(right)) || byUsername(left, right);
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
    const matches = (await db.user.findMany({ where, select: managedUserSelect })).filter(
      (user) => !query || [user.username, user.email, user.name].some((text) => containsLiteral(text, query)),
    );
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
  const orderBy: Prisma.UserOrderByWithRelationInput[] =
    ordering.field === 'joinedAt'
      ? [{ joinedAt: ordering.direction }, { username: 'asc' }]
      : [{ username: ordering.direction }];
  const users = await db.user.findMany({
    where,
    orderBy,
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: managedUserSelect,
  });
  return { users, stats: { total, editors, readers, admins }, page, totalPages };
}

export async function readManagedUsers(
  db: PrismaClient,
  request: FastifyRequest,
  actor: MemberActor,
): Promise<AdminUserList> {
  const params = userListQuery(request);
  const query = (params.get('q') ?? '').trim();
  const role = userRoleFilter(params.get('role'));
  const pageSizeValue = positiveInteger(params.get('pageSize'), 20);
  const pageSize = pageSizeValue < 1 ? 20 : Math.min(pageSizeValue, 100);
  const requestedPage = positiveInteger(params.get('page'), 1);
  const { users, stats, page, totalPages } = await managedUserPage(
    db,
    managedUserWhere(query, role),
    query,
    userOrdering(params.get('ordering')),
    pageSize,
    requestedPage,
  );
  return {
    users: users.map((row) => managedUser(row, actor)),
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

export async function updateManagedUserRole(
  db: PrismaClient,
  actor: MemberActor,
  targetId: number,
  roleValue: unknown,
): Promise<ApiResult<AdminManagedUser>> {
  if (roleValue !== 'READER' && roleValue !== 'EDITOR') {
    return { ok: false, code: 'RJ', message: 'This role is not supported.' };
  }
  return db.$transaction(async (transaction) => {
    const target = await transaction.user.findUnique({
      where: { id: targetId },
      select: { id: true, isStaff: true, isSuperuser: true },
    });
    if (!target) return { ok: false, code: 'NF', message: 'User not found.' };
    if (target.id === actor.id) return { ok: false, code: 'RJ', message: 'You cannot change your own role.' };
    if (target.isStaff || target.isSuperuser) {
      return { ok: false, code: 'RJ', message: 'Administrator roles cannot be changed from this page.' };
    }
    const profile = await transaction.profile.findUnique({ where: { userId: targetId }, select: { role: true } });
    if (profile) {
      await transaction.profile.update({
        where: { userId: targetId },
        data: { role: roleValue },
        select: { userId: true },
      });
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
    await transaction.userPreference.upsert({
      where: { userId: targetId },
      create: { userId: targetId },
      update: {},
      select: { userId: true },
    });
    const row = await transaction.user.findUniqueOrThrow({ where: { id: targetId }, select: managedUserSelect });
    return { ok: true, body: managedUser(row, actor) };
  });
}

type MemberPermission = keyof ReturnType<typeof memberPermissions>;

async function permittedMember(
  transaction: Prisma.TransactionClient,
  actor: MemberActor,
  targetId: number,
  permission: MemberPermission,
): Promise<{ ok: true; row: ManagedUserRow } | { ok: false; code: string; message: string }> {
  const row = await transaction.user.findUnique({ where: { id: targetId }, select: managedUserSelect });
  if (!row) return { ok: false, code: 'NF', message: 'User not found.' };
  if (!memberPermissions(row, actor)[permission]) {
    return { ok: false, code: 'RJ', message: 'You cannot perform this action on this account.' };
  }
  return { ok: true, row };
}

export async function setMemberActive(
  db: PrismaClient,
  actor: MemberActor,
  targetId: number,
  isActive: unknown,
): Promise<ApiResult<AdminManagedUser>> {
  if (typeof isActive !== 'boolean') return { ok: false, code: 'VA', message: 'Check the account status.' };
  return db.$transaction(async (transaction) => {
    const target = await permittedMember(transaction, actor, targetId, 'canChangeStatus');
    if (!target.ok) return target;
    if (target.row.isActive === isActive) return { ok: true, body: managedUser(target.row, actor) };
    await transaction.user.update({ where: { id: targetId }, data: { isActive }, select: { id: true } });
    if (!isActive) await transaction.session.deleteMany({ where: { userId: targetId } });
    await recordModeration(
      transaction,
      actor.id,
      'user',
      targetId,
      target.row.username,
      2,
      isActive ? 'Reactivated account' : 'Deactivated account',
    );
    const row = await transaction.user.findUniqueOrThrow({ where: { id: targetId }, select: managedUserSelect });
    return { ok: true, body: managedUser(row, actor) };
  });
}

export async function deleteMember(
  db: PrismaClient,
  actor: MemberActor,
  targetId: number,
  confirmedUsername: unknown,
  mediaRoot?: string,
): Promise<ApiResult<{ username: string }>> {
  const result = await db.$transaction(
    async (transaction) => {
      const target = await permittedMember(transaction, actor, targetId, 'canDelete');
      if (!target.ok) return target;
      if (confirmedUsername !== target.row.username) {
        return { ok: false as const, code: 'VA', message: 'Type the username to confirm.' };
      }
      const attachments = await removeAccountData(transaction, targetId);
      await recordModeration(transaction, actor.id, 'user', targetId, target.row.username, 3, 'Deleted account');
      return { ok: true as const, username: target.row.username, attachments };
    },
    { timeout: 15_000, isolationLevel: 'Serializable' },
  );
  if (!result.ok) return result;
  await removeAccountAttachments(result.attachments, mediaRoot);
  return { ok: true, body: { username: result.username } };
}

export async function resetMemberTwoFactor(
  db: PrismaClient,
  actor: MemberActor,
  targetId: number,
): Promise<ApiResult<AdminManagedUser>> {
  return db.$transaction(async (transaction) => {
    const target = await permittedMember(transaction, actor, targetId, 'canResetTwoFactor');
    if (!target.ok) return target;
    await transaction.twoFactorAuth.deleteMany({ where: { userId: targetId } });
    await transaction.session.deleteMany({ where: { userId: targetId } });
    await recordModeration(
      transaction,
      actor.id,
      'user',
      targetId,
      target.row.username,
      2,
      'Turned off two-factor authentication',
    );
    const row = await transaction.user.findUniqueOrThrow({ where: { id: targetId }, select: managedUserSelect });
    return { ok: true, body: managedUser(row, actor) };
  });
}

export async function issueMemberPasswordLink(
  db: PrismaClient,
  actor: MemberActor,
  targetId: number,
  secretKey: string,
  siteUrl: URL,
): Promise<ApiResult<{ url: string; expiresDate: string }>> {
  return db.$transaction(async (transaction) => {
    const target = await permittedMember(transaction, actor, targetId, 'canResetPassword');
    if (!target.ok) return target;
    const account = await transaction.user.findUniqueOrThrow({
      where: { id: targetId },
      select: { id: true, passwordHash: true },
    });
    const { token, expiresAt } = createPasswordResetToken(account, secretKey);
    await recordModeration(
      transaction,
      actor.id,
      'user',
      targetId,
      target.row.username,
      2,
      'Created a password reset link',
    );
    return {
      ok: true,
      body: { url: new URL(`/password-reset/${token}`, siteUrl).href, expiresDate: isoDate(expiresAt) },
    };
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
