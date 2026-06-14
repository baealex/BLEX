import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
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

const UserStatusBadge = ({ user }: { user: ManagedUser }) => {
    if (!user.isActive) {
        return <span className="rounded-full bg-danger-surface px-2 py-1 text-xs font-semibold text-danger">비활성</span>;
    }

    if (user.isSuperuser) {
        return <span className="rounded-full bg-warning-surface px-2 py-1 text-xs font-semibold text-warning">최고 관리자</span>;
    }

    if (user.isStaff) {
        return <span className="rounded-full bg-surface-subtle px-2 py-1 text-xs font-semibold text-content-secondary">관리자</span>;
    }

    return <span className="rounded-full bg-success-surface px-2 py-1 text-xs font-semibold text-success">활성</span>;
};

const UserManagementSetting = () => {
    const { confirm } = useConfirm();
    const queryClient = useQueryClient();
    const [query, setQuery] = useState('');
    const [appliedQuery, setAppliedQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<ManagedUserRoleFilter>('all');
    const [ordering, setOrdering] = useState<ManagedUserOrdering>('username');
    const [page, setPage] = useState(1);

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
        setAppliedQuery(query.trim());
    };

    const handleReset = () => {
        setQuery('');
        setAppliedQuery('');
        setRoleFilter('all');
        setOrdering('username');
        setPage(1);
    };

    const handleRoleFilterChange = (value: string) => {
        setRoleFilter(value as ManagedUserRoleFilter);
        setPage(1);
    };

    const handleOrderingChange = (value: string) => {
        setOrdering(value as ManagedUserOrdering);
        setPage(1);
    };

    const handlePageMove = (nextPage: number) => {
        if (nextPage < 1 || nextPage > pagination.totalPages || nextPage === currentPage) return;
        setPage(nextPage);
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
                description="운영자가 독자와 작가 권한을 한 화면에서 확인하고 변경합니다. 관리자 계정 권한은 안전을 위해 Django 관리자에서만 다룹니다."
            />

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl bg-surface p-5 ring-1 ring-line/60">
                    <p className="text-xs text-content-secondary">전체</p>
                    <p className="mt-1 text-2xl font-semibold text-content">{stats.total}</p>
                </div>
                <div className="rounded-2xl bg-surface p-5 ring-1 ring-line/60">
                    <p className="text-xs text-content-secondary">작가</p>
                    <p className="mt-1 text-2xl font-semibold text-content">{stats.editors}</p>
                </div>
                <div className="rounded-2xl bg-surface p-5 ring-1 ring-line/60">
                    <p className="text-xs text-content-secondary">독자</p>
                    <p className="mt-1 text-2xl font-semibold text-content">{stats.readers}</p>
                </div>
                <div className="rounded-2xl bg-surface p-5 ring-1 ring-line/60">
                    <p className="text-xs text-content-secondary">관리자</p>
                    <p className="mt-1 text-2xl font-semibold text-content">{stats.admins}</p>
                </div>
            </div>

            <Card
                title="작가 초대"
                subtitle="초대 링크를 만들어 새 작가를 초대합니다. 이 링크로 가입한 사용자는 바로 작가 권한을 받습니다."
                icon={<i className="fas fa-ticket" />}>
                <div className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-content-secondary">
                            초대 링크는 1회용입니다. 사용되면 자동으로 비활성화되고, 필요하면 사용 전에 삭제할 수 있습니다.
                        </p>
                        <Button
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
                                        variant="secondary"
                                        size="sm"
                                        disabled={invite.isClaimed || !invite.isActive}
                                        onClick={() => void handleCopyInvite(invite)}>
                                        링크 복사
                                    </Button>
                                    <Button
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
                                아직 만든 초대 링크가 없습니다.
                            </div>
                        )}
                    </div>
                </div>
            </Card>

            <Card
                title="사용자 목록"
                subtitle="사용자명, 이름, 이메일로 검색하고 권한과 포스트 수 기준으로 좁혀볼 수 있습니다."
                icon={<i className="fas fa-users" />}>
                <div className="mb-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_auto]">
                    <Input
                        placeholder="사용자 검색"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') handleSearch();
                        }}
                    />
                    <Select
                        value={roleFilter}
                        onValueChange={handleRoleFilterChange}
                        items={roleFilterItems}
                        className="min-h-10 py-2"
                    />
                    <Select
                        value={ordering}
                        onValueChange={handleOrderingChange}
                        items={orderingItems}
                        className="min-h-10 py-2"
                    />
                    <div className="flex gap-2">
                        <Button variant="secondary" onClick={handleSearch}>검색</Button>
                        {(appliedQuery || roleFilter !== 'all' || ordering !== 'username') && (
                            <Button variant="ghost" onClick={handleReset}>초기화</Button>
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
                            <div key={user.id} className="grid gap-4 px-4 py-4 md:grid-cols-[minmax(0,1.5fr)_110px_90px_100px_130px] md:items-center">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="truncate text-sm font-semibold text-content">{user.username}</p>
                                        {user.name && <span className="text-xs text-content-secondary">{user.name}</span>}
                                    </div>
                                    <p className="truncate text-xs text-content-secondary">{user.email || '이메일 없음'}</p>
                                </div>

                                <div className="space-y-1">
                                    <span className="text-xs font-medium text-content-secondary md:hidden">권한</span>
                                    {user.canChangeRole ? (
                                        <Select
                                            value={user.role}
                                            onValueChange={(value) => void handleRoleChange(user, value as ManagedUserRole)}
                                            items={roleItems}
                                            className="min-h-10 py-2"
                                            disabled={roleMutation.isPending && roleMutation.variables?.user.id === user.id}
                                        />
                                    ) : (
                                        <span className="text-sm font-medium text-content">{getRoleLabel(user.role)}</span>
                                    )}
                                </div>

                                <div className="flex items-center justify-between gap-3 text-sm text-content-secondary md:block md:text-content">
                                    <span className="text-xs font-medium md:hidden">포스트</span>
                                    <span>{user.postCount}</span>
                                </div>
                                <div className="flex items-center justify-between gap-3 md:block">
                                    <span className="text-xs font-medium text-content-secondary md:hidden">상태</span>
                                    <UserStatusBadge user={user} />
                                </div>
                                <div className="flex items-center justify-between gap-3 text-sm text-content-secondary md:block">
                                    <span className="text-xs font-medium md:hidden">가입일</span>
                                    <span>{formatDate(user.dateJoined)}</span>
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
                                variant="secondary"
                                size="sm"
                                disabled={!pagination.hasPrevious}
                                onClick={() => handlePageMove(1)}
                                aria-label="첫 페이지">
                                <i className="fas fa-angle-double-left" />
                            </Button>
                            <Button
                                variant="secondary"
                                size="sm"
                                disabled={!pagination.hasPrevious}
                                onClick={() => handlePageMove(currentPage - 1)}
                                aria-label="이전 페이지">
                                <i className="fas fa-angle-left" />
                            </Button>
                            {visiblePages.map(pageNumber => (
                                <Button
                                    key={pageNumber}
                                    variant={pageNumber === currentPage ? 'primary' : 'secondary'}
                                    size="sm"
                                    onClick={() => handlePageMove(pageNumber)}
                                    aria-current={pageNumber === currentPage ? 'page' : undefined}>
                                    {pageNumber}
                                </Button>
                            ))}
                            <Button
                                variant="secondary"
                                size="sm"
                                disabled={!pagination.hasNext}
                                onClick={() => handlePageMove(currentPage + 1)}
                                aria-label="다음 페이지">
                                <i className="fas fa-angle-right" />
                            </Button>
                            <Button
                                variant="secondary"
                                size="sm"
                                disabled={!pagination.hasNext}
                                onClick={() => handlePageMove(pagination.totalPages)}
                                aria-label="마지막 페이지">
                                <i className="fas fa-angle-double-right" />
                            </Button>
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default UserManagementSetting;
