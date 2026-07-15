import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import {
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    Ticket,
    Users
} from '@blex/ui/icons';
import { toast } from '~/utils/toast';
import { useConfirm } from '~/hooks/useConfirm';
import { SettingsHeader } from '../../components';
import { Button, Card, Input, Select } from '~/components/shared';
import {
    createAuthorInvite,
    deleteAuthorInvite,
    getAuthorInvites,
    getManagedUsers,
    updateManagedUserRole,
    type AuthorInvite,
    type ManagedUser,
    type ManagedUserOrdering,
    type ManagedUserRole,
    type ManagedUserRoleFilter
} from '~/lib/api/settings';

const roleItems = [
    {
        value: 'READER',
        label: '독자'
    },
    {
        value: 'EDITOR',
        label: '작가'
    }
];

const getRoleLabel = (role: ManagedUserRole) => roleItems.find(item => item.value === role)?.label ?? role;
const PAGE_SIZE = 20;

const roleFilterItems: { value: ManagedUserRoleFilter; label: string }[] = [
    {
        value: 'all',
        label: '전체 권한'
    },
    {
        value: 'reader',
        label: '독자만'
    },
    {
        value: 'editor',
        label: '작가만'
    },
    {
        value: 'admin',
        label: '관리자만'
    }
];

const orderingItems: { value: ManagedUserOrdering; label: string }[] = [
    {
        value: 'username',
        label: '아이디 오름차순'
    },
    {
        value: '-username',
        label: '아이디 내림차순'
    },
    {
        value: '-post_count',
        label: '포스트 많은 순'
    },
    {
        value: 'post_count',
        label: '포스트 적은 순'
    },
    {
        value: '-date_joined',
        label: '최근 가입순'
    },
    {
        value: 'date_joined',
        label: '오래된 가입순'
    }
];

const emptyUsersData = {
    users: [],
    pagination: {
        page: 1,
        pageSize: PAGE_SIZE,
        total: 0,
        totalPages: 1,
        hasNext: false,
        hasPrevious: false
    },
    stats: {
        total: 0,
        editors: 0,
        readers: 0,
        admins: 0
    }
};

const buildInviteUrl = (invite: AuthorInvite) => `${window.location.origin}${invite.signupUrl}`;

const formatDate = (value: string | null) => {
    if (!value) return '-';
    return new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date(value));
};

const getUserStatusLabel = (user: ManagedUser) => {
    if (!user.isActive) return '비활성';
    if (user.isSuperuser) return '최고 관리자';
    if (user.isStaff) return '관리자';
    return '활성';
};

const UserStatusBadge = ({ user }: { user: ManagedUser }) => {
    const label = getUserStatusLabel(user);
    const classes = !user.isActive
        ? 'bg-danger-surface text-danger'
        : user.isSuperuser
            ? 'bg-warning-surface text-warning'
            : user.isStaff
                ? 'bg-surface-subtle text-content-secondary'
                : 'bg-success-surface text-success';

    return <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${classes}`}>{label}</span>;
};

interface MobileUserRowProps {
    user: ManagedUser;
    isExpanded: boolean;
    isRoleUpdating: boolean;
    onToggle: () => void;
    onRoleChange: (role: ManagedUserRole) => void;
}

const MobileUserRow = ({
    user,
    isExpanded,
    isRoleUpdating,
    onToggle,
    onRoleChange
}: MobileUserRowProps) => {
    const detailsId = `managed-user-details-${user.id}`;
    const toggleId = `managed-user-toggle-${user.id}`;

    return (
        <div className="md:hidden">
            <button
                id={toggleId}
                type="button"
                aria-expanded={isExpanded}
                aria-controls={detailsId}
                aria-label={`${user.username}, ${getUserStatusLabel(user)}, ${getRoleLabel(user.role)}, 상세 ${isExpanded ? '접기' : '펼치기'}`}
                onClick={onToggle}
                className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-subtle active:bg-surface-subtle motion-reduce:transition-none">
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-content">{user.username}</span>
                    <span className="mt-1 flex min-w-0 items-center gap-2">
                        {user.name && (
                            <span className="min-w-0 truncate text-xs text-content-secondary">{user.name}</span>
                        )}
                        <UserStatusBadge user={user} />
                    </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full bg-surface-subtle px-2.5 py-1 text-xs font-semibold text-content-secondary">
                        {getRoleLabel(user.role)}
                    </span>
                    <ChevronDown
                        aria-hidden="true"
                        className={`h-4 w-4 text-content-hint transition-transform motion-reduce:transition-none ${isExpanded ? 'rotate-180' : ''}`}
                    />
                </span>
            </button>

            {isExpanded && (
                <div
                    id={detailsId}
                    role="region"
                    aria-labelledby={toggleId}
                    className="border-t border-line bg-surface-subtle/40 px-4 py-4">
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                        <div className="col-span-2 min-w-0">
                            <dt className="text-xs font-medium text-content-hint">이메일</dt>
                            <dd className="mt-1 truncate text-sm text-content-secondary">{user.email || '이메일 없음'}</dd>
                        </div>
                        <div>
                            <dt className="text-xs font-medium text-content-hint">포스트</dt>
                            <dd className="mt-1 text-sm font-medium text-content">{user.postCount}</dd>
                        </div>
                        <div>
                            <dt className="text-xs font-medium text-content-hint">가입일</dt>
                            <dd className="mt-1 text-sm font-medium text-content">{formatDate(user.dateJoined)}</dd>
                        </div>
                    </dl>

                    <div className="mt-4 border-t border-line pt-4">
                        <p className="mb-2 text-xs font-medium text-content-hint">권한</p>
                        {user.canChangeRole ? (
                            <Select
                                density="compact"
                                value={user.role}
                                onValueChange={(value) => onRoleChange(value as ManagedUserRole)}
                                items={roleItems}
                                className="min-h-11 py-2"
                                disabled={isRoleUpdating}
                            />
                        ) : (
                            <p className="flex min-h-11 items-center text-sm font-medium text-content">
                                {getRoleLabel(user.role)}
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const UserManagementSetting = () => {
    const { confirm } = useConfirm();
    const queryClient = useQueryClient();
    const [query, setQuery] = useState('');
    const [appliedQuery, setAppliedQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<ManagedUserRoleFilter>('all');
    const [ordering, setOrdering] = useState<ManagedUserOrdering>('username');
    const [page, setPage] = useState(1);
    const [expandedUserId, setExpandedUserId] = useState<number | null>(null);

    const {
        data: fetchedUsersData,
        isError: isUsersError,
        isFetching: isUsersFetching
    } = useQuery({
        queryKey: ['admin-users', appliedQuery, roleFilter, ordering, page],
        queryFn: async () => {
            const { data } = await getManagedUsers(appliedQuery, page, PAGE_SIZE, roleFilter, ordering);
            if (data.status === 'DONE') {
                return data.body;
            }
            throw new Error(data.errorMessage || '사용자 목록을 불러오지 못했습니다.');
        },
        placeholderData: previousData => previousData
    });

    const { data: invites } = useSuspenseQuery({
        queryKey: ['author-invites'],
        queryFn: async () => {
            const { data } = await getAuthorInvites();
            if (data.status === 'DONE') {
                return data.body.invites;
            }
            throw new Error(data.errorMessage || '초대 코드를 불러오지 못했습니다.');
        }
    });

    const usersData = fetchedUsersData ?? emptyUsersData;
    const users = usersData.users;
    const stats = usersData.stats;
    const pagination = usersData.pagination;
    const currentPage = pagination.page;
    const visiblePages = useMemo(() => {
        const lastPage = pagination.totalPages;

        if (lastPage <= 5) {
            return Array.from({ length: lastPage }, (_, index) => index + 1);
        }

        if (currentPage <= 3) {
            return [1, 2, 3, 4, 5];
        }

        if (currentPage >= lastPage - 2) {
            return [lastPage - 4, lastPage - 3, lastPage - 2, lastPage - 1, lastPage];
        }

        return [currentPage - 2, currentPage - 1, currentPage, currentPage + 1, currentPage + 2];
    }, [currentPage, pagination.totalPages]);

    const roleMutation = useMutation({
        mutationFn: ({ user, role }: { user: ManagedUser; role: ManagedUserRole }) => updateManagedUserRole(user.id, role),
        onSuccess: ({ data }) => {
            if (data.status === 'DONE') {
                toast.success(`${data.body.user.username}님의 권한을 ${getRoleLabel(data.body.user.role)}로 변경했습니다.`);
                void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
                return;
            }
            toast.error(data.errorMessage || '권한 변경에 실패했습니다.');
        },
        onError: () => toast.error('권한 변경에 실패했습니다.')
    });

    const inviteMutation = useMutation({
        mutationFn: () => createAuthorInvite(),
        onSuccess: async ({ data }) => {
            if (data.status === 'DONE') {
                const inviteUrl = buildInviteUrl(data.body.invite);
                try {
                    await navigator.clipboard.writeText(inviteUrl);
                    toast.success('작가 초대 링크를 만들고 클립보드에 복사했습니다.');
                } catch {
                    toast.success('작가 초대 링크를 만들었습니다.');
                }
                void queryClient.invalidateQueries({ queryKey: ['author-invites'] });
                return;
            }
            toast.error(data.errorMessage || '초대 코드 생성에 실패했습니다.');
        },
        onError: () => toast.error('초대 코드 생성에 실패했습니다.')
    });

    const deleteInviteMutation = useMutation({
        mutationFn: (invite: AuthorInvite) => deleteAuthorInvite(invite.id),
        onSuccess: ({ data }) => {
            if (data.status === 'DONE') {
                toast.success('초대 링크를 삭제했습니다.');
                void queryClient.invalidateQueries({ queryKey: ['author-invites'] });
                return;
            }
            toast.error(data.errorMessage || '초대 링크 삭제에 실패했습니다.');
        },
        onError: () => toast.error('초대 링크 삭제에 실패했습니다.')
    });

    const handleRoleChange = async (user: ManagedUser, nextRole: ManagedUserRole) => {
        if (user.role === nextRole) return;

        const confirmed = await confirm({
            title: '권한 변경',
            message: `${user.username}님의 권한을 ${getRoleLabel(user.role)}에서 ${getRoleLabel(nextRole)}로 변경하시겠습니까?`,
            confirmText: '변경'
        });

        if (confirmed) {
            roleMutation.mutate({
                user,
                role: nextRole
            });
        }
    };

    const handleSearch = () => {
        setPage(1);
        setExpandedUserId(null);
        setAppliedQuery(query.trim());
    };

    const handleReset = () => {
        setQuery('');
        setAppliedQuery('');
        setRoleFilter('all');
        setOrdering('username');
        setPage(1);
        setExpandedUserId(null);
    };

    const handleRoleFilterChange = (value: string) => {
        setRoleFilter(value as ManagedUserRoleFilter);
        setPage(1);
        setExpandedUserId(null);
    };

    const handleOrderingChange = (value: string) => {
        setOrdering(value as ManagedUserOrdering);
        setPage(1);
        setExpandedUserId(null);
    };

    const handlePageMove = (nextPage: number) => {
        if (nextPage < 1 || nextPage > pagination.totalPages || nextPage === currentPage) return;
        setPage(nextPage);
        setExpandedUserId(null);
    };

    const handleUserToggle = (userId: number) => {
        setExpandedUserId(currentId => currentId === userId ? null : userId);
    };

    const handleCopyInvite = async (invite: AuthorInvite) => {
        try {
            await navigator.clipboard.writeText(buildInviteUrl(invite));
            toast.success('초대 링크를 복사했습니다.');
        } catch {
            toast.error('초대 링크 복사에 실패했습니다.');
        }
    };

    const handleDeleteInvite = async (invite: AuthorInvite) => {
        const confirmed = await confirm({
            title: '초대 링크 삭제',
            message: '이 초대 링크를 삭제하시겠습니까? 삭제하면 해당 링크로 가입할 수 없습니다.',
            confirmText: '삭제',
            variant: 'danger'
        });

        if (confirmed) {
            deleteInviteMutation.mutate(invite);
        }
    };

    return (
        <div className="space-y-8">
            <SettingsHeader
                title="사용자 권한"
                description="관리자 권한은 Django 관리자에서만 변경할 수 있습니다."
            />

            <dl
                aria-label="사용자 통계"
                className="grid grid-cols-4 divide-x divide-line overflow-hidden rounded-xl border border-line bg-surface">
                <div className="min-w-0 px-2 py-3 text-center sm:px-4">
                    <dt className="text-xs text-content-secondary">전체</dt>
                    <dd className="mt-1 text-xl font-semibold text-content">{stats.total}</dd>
                </div>
                <div className="min-w-0 px-2 py-3 text-center sm:px-4">
                    <dt className="text-xs text-content-secondary">작가</dt>
                    <dd className="mt-1 text-xl font-semibold text-content">{stats.editors}</dd>
                </div>
                <div className="min-w-0 px-2 py-3 text-center sm:px-4">
                    <dt className="text-xs text-content-secondary">독자</dt>
                    <dd className="mt-1 text-xl font-semibold text-content">{stats.readers}</dd>
                </div>
                <div className="min-w-0 px-2 py-3 text-center sm:px-4">
                    <dt className="text-xs text-content-secondary">관리자</dt>
                    <dd className="mt-1 text-xl font-semibold text-content">{stats.admins}</dd>
                </div>
            </dl>

            <Card
                title="작가 초대"
                subtitle="링크로 가입하면 즉시 작가 권한이 부여됩니다."
                icon={<Ticket aria-hidden="true" className="h-4 w-4" />}>
                <div className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-content-secondary">
                            초대 링크는 한 번만 사용할 수 있으며, 사용 전에는 삭제할 수 있습니다.
                        </p>
                        <Button
                            density="compact"
                            variant="primary"
                            isLoading={inviteMutation.isPending}
                            onClick={() => inviteMutation.mutate()}>
                            초대 링크 만들기
                        </Button>
                    </div>

                    <div className="divide-y divide-line rounded-xl border border-line">
                        {invites.map(invite => (
                            <div key={invite.id} className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <code className="rounded-lg bg-surface-subtle px-2 py-1 text-xs text-content">{invite.code}</code>
                                        {invite.isClaimed ? (
                                            <span className="rounded-full bg-success-surface px-2 py-1 text-xs font-semibold text-success">
                                                사용됨
                                            </span>
                                        ) : (
                                            <span className="rounded-full bg-warning-surface px-2 py-1 text-xs font-semibold text-warning">
                                                대기
                                            </span>
                                        )}
                                    </div>
                                    <p className="mt-2 truncate text-xs text-content-secondary">
                                        {invite.isClaimed ? `${invite.claimedBy} 가입 완료` : buildInviteUrl(invite)}
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2 lg:flex-shrink-0">
                                    <Button
                                        density="compact"
                                        variant="secondary"
                                        size="sm"
                                        disabled={invite.isClaimed || !invite.isActive}
                                        onClick={() => void handleCopyInvite(invite)}>
                                        링크 복사
                                    </Button>
                                    <Button
                                        density="compact"
                                        variant="danger"
                                        size="sm"
                                        isLoading={deleteInviteMutation.isPending && deleteInviteMutation.variables?.id === invite.id}
                                        disabled={invite.isClaimed}
                                        onClick={() => void handleDeleteInvite(invite)}>
                                        삭제
                                    </Button>
                                </div>
                            </div>
                        ))}

                        {invites.length === 0 && (
                            <div className="px-4 py-8 text-center text-sm text-content-secondary">
                                초대 링크가 없습니다.
                            </div>
                        )}
                    </div>
                </div>
            </Card>

            <Card
                title="사용자 목록"
                icon={<Users aria-hidden="true" className="h-4 w-4" />}>
                <div className="mb-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_auto]">
                    <Input
                        density="compact"
                        aria-label="사용자 검색"
                        placeholder="아이디·이름·이메일 검색"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') handleSearch();
                        }}
                    />
                    <Select
                        density="compact"
                        value={roleFilter}
                        onValueChange={handleRoleFilterChange}
                        items={roleFilterItems}
                    />
                    <Select
                        density="compact"
                        value={ordering}
                        onValueChange={handleOrderingChange}
                        items={orderingItems}
                    />
                    <div className="flex gap-2">
                        <Button density="compact" variant="secondary" onClick={handleSearch}>검색</Button>
                        {(appliedQuery || roleFilter !== 'all' || ordering !== 'username') && (
                            <Button density="compact" variant="ghost" onClick={handleReset}>초기화</Button>
                        )}
                    </div>
                </div>

                {isUsersFetching && fetchedUsersData && (
                    <p className="mb-3 text-xs text-content-secondary">사용자 목록을 업데이트하는 중입니다.</p>
                )}

                <div className="overflow-hidden rounded-xl border border-line">
                    <div className="hidden grid-cols-[minmax(0,1.5fr)_110px_90px_100px_130px] gap-4 bg-surface-subtle px-4 py-3 text-xs font-semibold text-content-secondary md:grid">
                        <span>사용자</span>
                        <span>권한</span>
                        <span>포스트</span>
                        <span>상태</span>
                        <span>가입일</span>
                    </div>

                    <div className="divide-y divide-line">
                        {users.map(user => (
                            <div key={user.id}>
                                <MobileUserRow
                                    user={user}
                                    isExpanded={expandedUserId === user.id}
                                    isRoleUpdating={roleMutation.isPending && roleMutation.variables?.user.id === user.id}
                                    onToggle={() => handleUserToggle(user.id)}
                                    onRoleChange={role => void handleRoleChange(user, role)}
                                />

                                <div className="hidden gap-4 px-4 py-4 md:grid md:grid-cols-[minmax(0,1.5fr)_110px_90px_100px_130px] md:items-center">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="truncate text-sm font-semibold text-content">{user.username}</p>
                                            {user.name && <span className="text-xs text-content-secondary">{user.name}</span>}
                                        </div>
                                        <p className="truncate text-xs text-content-secondary">{user.email || '이메일 없음'}</p>
                                    </div>

                                    <div className="space-y-1">
                                        {user.canChangeRole ? (
                                            <Select
                                                density="compact"
                                                value={user.role}
                                                onValueChange={(value) => void handleRoleChange(user, value as ManagedUserRole)}
                                                items={roleItems}
                                                disabled={roleMutation.isPending && roleMutation.variables?.user.id === user.id}
                                            />
                                        ) : (
                                            <span className="text-sm font-medium text-content">{getRoleLabel(user.role)}</span>
                                        )}
                                    </div>

                                    <div className="text-sm text-content">
                                        <span>{user.postCount}</span>
                                    </div>
                                    <div>
                                        <UserStatusBadge user={user} />
                                    </div>
                                    <div className="text-sm text-content-secondary">
                                        <span>{formatDate(user.dateJoined)}</span>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {isUsersError ? (
                            <div className="px-4 py-8 text-center text-sm text-danger">
                                사용자 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
                            </div>
                        ) : users.length === 0 && (
                            <div className="px-4 py-8 text-center text-sm text-content-secondary">
                                검색 결과가 없습니다.
                            </div>
                        )}
                    </div>
                </div>

                {pagination.totalPages > 1 && (
                    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-content-secondary">
                            총 {pagination.total}명 중 {(pagination.page - 1) * pagination.pageSize + 1}
                            -{Math.min(pagination.page * pagination.pageSize, pagination.total)}명 표시
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                density="compact"
                                variant="secondary"
                                size="sm"
                                disabled={!pagination.hasPrevious}
                                onClick={() => handlePageMove(1)}
                                aria-label="첫 페이지">
                                <ChevronsLeft aria-hidden="true" className="h-4 w-4" />
                            </Button>
                            <Button
                                density="compact"
                                variant="secondary"
                                size="sm"
                                disabled={!pagination.hasPrevious}
                                onClick={() => handlePageMove(currentPage - 1)}
                                aria-label="이전 페이지">
                                <ChevronLeft aria-hidden="true" className="h-4 w-4" />
                            </Button>
                            {visiblePages.map(pageNumber => (
                                <Button
                                    density="compact"
                                    key={pageNumber}
                                    variant={pageNumber === currentPage ? 'primary' : 'secondary'}
                                    size="sm"
                                    onClick={() => handlePageMove(pageNumber)}
                                    aria-current={pageNumber === currentPage ? 'page' : undefined}>
                                    {pageNumber}
                                </Button>
                            ))}
                            <Button
                                density="compact"
                                variant="secondary"
                                size="sm"
                                disabled={!pagination.hasNext}
                                onClick={() => handlePageMove(currentPage + 1)}
                                aria-label="다음 페이지">
                                <ChevronRight aria-hidden="true" className="h-4 w-4" />
                            </Button>
                            <Button
                                density="compact"
                                variant="secondary"
                                size="sm"
                                disabled={!pagination.hasNext}
                                onClick={() => handlePageMove(pagination.totalPages)}
                                aria-label="마지막 페이지">
                                <ChevronsRight aria-hidden="true" className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default UserManagementSetting;
