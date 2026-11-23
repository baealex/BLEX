import { useState } from 'react';
import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import {
    ChevronDown,
    Ticket,
    Users
} from '@blex/ui/icons';
import { toast } from '~/utils/toast';
import { useConfirm } from '~/hooks/useConfirm';
import { SettingsHeader, SettingsPagination } from '../../components';
import { MemberActions } from './MemberActions';
import { Button, Card, Input, Select } from '~/components/shared';
import { getDocumentTimeZone, normalizeLocale } from '~/i18n/locale';
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

const roleItems: Array<{ value: ManagedUserRole; label: MessageDescriptor }> = [
    {
        value: 'READER',
        label: msg({
            id: 'settings.users.role.reader',
            message: 'Reader'
        })
    },
    {
        value: 'EDITOR',
        label: msg({
            id: 'settings.users.role.author',
            message: 'Author'
        })
    }
];

const PAGE_SIZE = 20;

const roleFilterItems: Array<{
    value: ManagedUserRoleFilter;
    label: MessageDescriptor;
}> = [
    {
        value: 'all',
        label: msg({
            id: 'settings.users.filter.all_roles',
            message: 'All roles'
        })
    },
    {
        value: 'reader',
        label: msg({
            id: 'settings.users.filter.readers',
            message: 'Readers only'
        })
    },
    {
        value: 'editor',
        label: msg({
            id: 'settings.users.filter.authors',
            message: 'Authors only'
        })
    },
    {
        value: 'admin',
        label: msg({
            id: 'settings.users.filter.admins',
            message: 'Administrators only'
        })
    }
];

const orderingItems: Array<{
    value: ManagedUserOrdering;
    label: MessageDescriptor;
}> = [
    {
        value: 'username',
        label: msg({
            id: 'settings.users.order.username_asc',
            message: 'Username: A to Z'
        })
    },
    {
        value: '-username',
        label: msg({
            id: 'settings.users.order.username_desc',
            message: 'Username: Z to A'
        })
    },
    {
        value: '-postCount',
        label: msg({
            id: 'settings.users.order.posts_desc',
            message: 'Most posts'
        })
    },
    {
        value: 'postCount',
        label: msg({
            id: 'settings.users.order.posts_asc',
            message: 'Fewest posts'
        })
    },
    {
        value: '-dateJoined',
        label: msg({
            id: 'settings.users.order.joined_desc',
            message: 'Newest members'
        })
    },
    {
        value: 'dateJoined',
        label: msg({
            id: 'settings.users.order.joined_asc',
            message: 'Oldest members'
        })
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

const formatDate = (value: string | null, locale: string) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeZone: getDocumentTimeZone()
    }).format(date);
};

const getUserStatusMessage = (user: ManagedUser): MessageDescriptor => {
    if (!user.isActive) {
        return msg({
            id: 'settings.users.status.inactive',
            message: 'Inactive'
        });
    }
    if (user.isSuperuser) {
        return msg({
            id: 'settings.users.status.superuser',
            message: 'Superuser'
        });
    }
    if (user.isStaff) {
        return msg({
            id: 'settings.users.status.administrator',
            message: 'Administrator'
        });
    }
    return msg({
        id: 'settings.users.status.active',
        message: 'Active'
    });
};

const hasMemberActions = (user: ManagedUser) => (
    user.canChangeStatus || user.canDelete || user.canResetPassword || user.canResetTwoFactor
);

const UserStatusBadge = ({ user }: { user: ManagedUser }) => {
    const { i18n } = useLingui();
    const label = i18n._(getUserStatusMessage(user));
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
    const { i18n, t } = useLingui();
    const localizedRoleItems = roleItems.map(item => ({
        value: item.value,
        label: i18n._(item.label)
    }));
    const getRoleLabel = (role: ManagedUserRole) => (
        localizedRoleItems.find(item => item.value === role)?.label ?? role
    );
    const detailsId = `managed-user-details-${user.id}`;
    const toggleId = `managed-user-toggle-${user.id}`;
    const userStatusLabel = i18n._(getUserStatusMessage(user));
    const detailsAction = isExpanded
        ? t({
            id: 'settings.users.details.collapse',
            message: 'collapse'
        })
        : t({
            id: 'settings.users.details.expand',
            message: 'expand'
        });

    return (
        <div className="md:hidden">
            <button
                id={toggleId}
                type="button"
                aria-expanded={isExpanded}
                aria-controls={detailsId}
                aria-label={i18n._({
                    id: 'settings.users.details.toggle_label',
                    message: '{username}, {status}, {role}, {action} details',
                    values: {
                        username: user.username,
                        status: userStatusLabel,
                        role: getRoleLabel(user.role),
                        action: detailsAction
                    }
                })}
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
                            <dt className="text-xs font-medium text-content-hint">
                                <Trans id="settings.users.field.email">Email</Trans>
                            </dt>
                            <dd className="mt-1 truncate text-sm text-content-secondary">
                                {user.email || t({
                                    id: 'settings.users.field.no_email',
                                    message: 'No email address'
                                })}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs font-medium text-content-hint">
                                <Trans id="settings.users.field.posts">Posts</Trans>
                            </dt>
                            <dd className="mt-1 text-sm font-medium text-content">{user.postCount}</dd>
                        </div>
                        <div>
                            <dt className="text-xs font-medium text-content-hint">
                                <Trans id="settings.users.field.joined">Joined</Trans>
                            </dt>
                            <dd className="mt-1 text-sm font-medium text-content">
                                {formatDate(user.dateJoined, normalizeLocale(i18n.locale))}
                            </dd>
                        </div>
                    </dl>

                    <div className="mt-4 border-t border-line pt-4">
                        <p className="mb-2 text-xs font-medium text-content-hint">
                            <Trans id="settings.users.field.role">Role</Trans>
                        </p>
                        {user.canChangeRole ? (
                            <Select
                                density="compact"
                                value={user.role}
                                ariaLabel={i18n._({
                                    id: 'settings.users.role.select_aria',
                                    message: 'Change role for {username}',
                                    values: { username: user.username }
                                })}
                                onValueChange={(value) => onRoleChange(value as ManagedUserRole)}
                                items={localizedRoleItems}
                                className="min-h-11 py-2"
                                disabled={isRoleUpdating}
                            />
                        ) : (
                            <p className="flex min-h-11 items-center text-sm font-medium text-content">
                                {getRoleLabel(user.role)}
                            </p>
                        )}
                    </div>

                    <MemberActions user={user} />
                </div>
            )}
        </div>
    );
};

const UserManagementSetting = () => {
    const { i18n, t } = useLingui();
    const { confirm } = useConfirm();
    const queryClient = useQueryClient();
    const [query, setQuery] = useState('');
    const [appliedQuery, setAppliedQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<ManagedUserRoleFilter>('all');
    const [ordering, setOrdering] = useState<ManagedUserOrdering>('username');
    const [page, setPage] = useState(1);
    const [expandedUserId, setExpandedUserId] = useState<number | null>(null);
    const localizedRoleItems = roleItems.map(item => ({
        value: item.value,
        label: i18n._(item.label)
    }));
    const localizedRoleFilterItems = roleFilterItems.map(item => ({
        value: item.value,
        label: i18n._(item.label)
    }));
    const localizedOrderingItems = orderingItems.map(item => ({
        value: item.value,
        label: i18n._(item.label)
    }));
    const getRoleLabel = (role: ManagedUserRole) => (
        localizedRoleItems.find(item => item.value === role)?.label ?? role
    );
    const locale = normalizeLocale(i18n.locale);

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
            throw new Error(data.errorMessage || t({
                id: 'settings.users.load_failed',
                message: 'Could not load the user list.'
            }));
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
            throw new Error(data.errorMessage || t({
                id: 'settings.users.invites.load_failed',
                message: 'Could not load invitation links.'
            }));
        }
    });

    const usersData = fetchedUsersData ?? emptyUsersData;
    const users = usersData.users;
    const stats = usersData.stats;
    const pagination = usersData.pagination;
    const currentPage = pagination.page;
    const roleMutation = useMutation({
        mutationFn: ({ user, role }: { user: ManagedUser; role: ManagedUserRole }) => updateManagedUserRole(user.id, role),
        onSuccess: ({ data }) => {
            if (data.status === 'DONE') {
                toast.success(i18n._({
                    id: 'settings.users.role_change.success',
                    message: 'Changed {username}\'s role to {role}.',
                    values: {
                        username: data.body.user.username,
                        role: getRoleLabel(data.body.user.role)
                    }
                }));
                void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
                return;
            }
            toast.error(data.errorMessage || t({
                id: 'settings.users.role_change.failed',
                message: 'Could not change the role.'
            }));
        },
        onError: () => toast.error(t({
            id: 'settings.users.role_change.failed',
            message: 'Could not change the role.'
        }))
    });

    const inviteMutation = useMutation({
        mutationFn: () => createAuthorInvite(),
        onSuccess: async ({ data }) => {
            if (data.status === 'DONE') {
                const inviteUrl = buildInviteUrl(data.body.invite);
                try {
                    await navigator.clipboard.writeText(inviteUrl);
                    toast.success(t({
                        id: 'settings.users.invites.create_and_copy_success',
                        message: 'Author invitation link created and copied to the clipboard.'
                    }));
                } catch {
                    toast.success(t({
                        id: 'settings.users.invites.create_success',
                        message: 'Author invitation link created.'
                    }));
                }
                void queryClient.invalidateQueries({ queryKey: ['author-invites'] });
                return;
            }
            toast.error(data.errorMessage || t({
                id: 'settings.users.invites.create_failed',
                message: 'Could not create the invitation link.'
            }));
        },
        onError: () => toast.error(t({
            id: 'settings.users.invites.create_failed',
            message: 'Could not create the invitation link.'
        }))
    });

    const deleteInviteMutation = useMutation({
        mutationFn: (invite: AuthorInvite) => deleteAuthorInvite(invite.id),
        onSuccess: ({ data }) => {
            if (data.status === 'DONE') {
                toast.success(t({
                    id: 'settings.users.invites.delete_success',
                    message: 'Invitation link deleted.'
                }));
                void queryClient.invalidateQueries({ queryKey: ['author-invites'] });
                return;
            }
            toast.error(data.errorMessage || t({
                id: 'settings.users.invites.delete_failed',
                message: 'Could not delete the invitation link.'
            }));
        },
        onError: () => toast.error(t({
            id: 'settings.users.invites.delete_failed',
            message: 'Could not delete the invitation link.'
        }))
    });

    const handleRoleChange = async (user: ManagedUser, nextRole: ManagedUserRole) => {
        if (user.role === nextRole) return;

        const confirmed = await confirm({
            title: t({
                id: 'settings.users.role_change.title',
                message: 'Change role'
            }),
            message: i18n._({
                id: 'settings.users.role_change.message',
                message: 'Change {username}\'s role from {currentRole} to {nextRole}?',
                values: {
                    username: user.username,
                    currentRole: getRoleLabel(user.role),
                    nextRole: getRoleLabel(nextRole)
                }
            }),
            confirmText: t({
                id: 'common.change',
                message: 'Change'
            })
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
            toast.success(t({
                id: 'settings.users.invites.copy_success',
                message: 'Invitation link copied.'
            }));
        } catch {
            toast.error(t({
                id: 'settings.users.invites.copy_failed',
                message: 'Could not copy the invitation link.'
            }));
        }
    };

    const handleDeleteInvite = async (invite: AuthorInvite) => {
        const confirmed = await confirm({
            title: t({
                id: 'settings.users.invites.delete.title',
                message: 'Delete invitation link'
            }),
            message: t({
                id: 'settings.users.invites.delete.message',
                message: 'Delete this invitation link? New users will no longer be able to sign up with it.'
            }),
            confirmText: t({
                id: 'common.delete',
                message: 'Delete'
            }),
            variant: 'danger'
        });

        if (confirmed) {
            deleteInviteMutation.mutate(invite);
        }
    };

    return (
        <div className="space-y-8">
            <SettingsHeader
                title={t({
                    id: 'settings.users.title',
                    message: 'User management'
                })}
                description={t({
                    id: 'settings.users.description',
                    message: 'Change roles, suspend or delete members, and help them recover their accounts. Administrator access cannot be changed here.'
                })}
            />

            <dl
                aria-label={t({
                    id: 'settings.users.stats.label',
                    message: 'User statistics'
                })}
                className="grid grid-cols-4 divide-x divide-line overflow-hidden rounded-xl border border-line bg-surface">
                <div className="min-w-0 px-2 py-3 text-center sm:px-4">
                    <dt className="text-xs text-content-secondary">
                        <Trans id="settings.users.stats.total">Total</Trans>
                    </dt>
                    <dd className="mt-1 text-xl font-semibold text-content">{stats.total}</dd>
                </div>
                <div className="min-w-0 px-2 py-3 text-center sm:px-4">
                    <dt className="text-xs text-content-secondary">
                        <Trans id="settings.users.stats.authors">Authors</Trans>
                    </dt>
                    <dd className="mt-1 text-xl font-semibold text-content">{stats.editors}</dd>
                </div>
                <div className="min-w-0 px-2 py-3 text-center sm:px-4">
                    <dt className="text-xs text-content-secondary">
                        <Trans id="settings.users.stats.readers">Readers</Trans>
                    </dt>
                    <dd className="mt-1 text-xl font-semibold text-content">{stats.readers}</dd>
                </div>
                <div className="min-w-0 px-2 py-3 text-center sm:px-4">
                    <dt className="text-xs text-content-secondary">
                        <Trans id="settings.users.stats.administrators">Administrators</Trans>
                    </dt>
                    <dd className="mt-1 text-xl font-semibold text-content">{stats.admins}</dd>
                </div>
            </dl>

            <Card
                title={t({
                    id: 'settings.users.invites.title',
                    message: 'Invite authors'
                })}
                subtitle={t({
                    id: 'settings.users.invites.description',
                    message: 'Anyone who signs up through an invitation link receives author access immediately.'
                })}
                icon={<Ticket aria-hidden="true" className="h-4 w-4" />}>
                <div className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-content-secondary">
                            <Trans id="settings.users.invites.usage_notice">
                                Each invitation link can be used once and can be deleted before it is claimed.
                            </Trans>
                        </p>
                        <Button
                            density="compact"
                            variant="primary"
                            isLoading={inviteMutation.isPending}
                            onClick={() => inviteMutation.mutate()}>
                            <Trans id="settings.users.invites.create_action">Create invitation link</Trans>
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
                                                <Trans id="settings.users.invites.status.claimed">Claimed</Trans>
                                            </span>
                                        ) : (
                                            <span className="rounded-full bg-warning-surface px-2 py-1 text-xs font-semibold text-warning">
                                                <Trans id="settings.users.invites.status.pending">Pending</Trans>
                                            </span>
                                        )}
                                    </div>
                                    <p className="mt-2 truncate text-xs text-content-secondary">
                                        {invite.isClaimed
                                            ? i18n._({
                                                id: 'settings.users.invites.claimed_by',
                                                message: 'Claimed by {username}',
                                                values: { username: invite.claimedBy }
                                            })
                                            : buildInviteUrl(invite)}
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2 lg:flex-shrink-0">
                                    <Button
                                        density="compact"
                                        variant="secondary"
                                        size="sm"
                                        disabled={invite.isClaimed || !invite.isActive}
                                        onClick={() => void handleCopyInvite(invite)}>
                                        <Trans id="settings.users.invites.copy_action">Copy link</Trans>
                                    </Button>
                                    <Button
                                        density="compact"
                                        variant="danger"
                                        size="sm"
                                        isLoading={deleteInviteMutation.isPending && deleteInviteMutation.variables?.id === invite.id}
                                        disabled={invite.isClaimed}
                                        onClick={() => void handleDeleteInvite(invite)}>
                                        <Trans id="common.delete">Delete</Trans>
                                    </Button>
                                </div>
                            </div>
                        ))}

                        {invites.length === 0 && (
                            <div className="px-4 py-8 text-center text-sm text-content-secondary">
                                <Trans id="settings.users.invites.empty">There are no invitation links.</Trans>
                            </div>
                        )}
                    </div>
                </div>
            </Card>

            <Card
                title={t({
                    id: 'settings.users.list.title',
                    message: 'Users'
                })}
                icon={<Users aria-hidden="true" className="h-4 w-4" />}>
                <div className="mb-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_auto]">
                    <Input
                        density="compact"
                        aria-label={t({
                            id: 'settings.users.search.label',
                            message: 'Search users'
                        })}
                        placeholder={t({
                            id: 'settings.users.search.placeholder',
                            message: 'Search username, name, or email'
                        })}
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') handleSearch();
                        }}
                    />
                    <Select
                        density="compact"
                        value={roleFilter}
                        ariaLabel={t({
                            id: 'settings.users.filters.role_aria',
                            message: 'Filter users by role'
                        })}
                        onValueChange={handleRoleFilterChange}
                        items={localizedRoleFilterItems}
                    />
                    <Select
                        density="compact"
                        value={ordering}
                        ariaLabel={t({
                            id: 'settings.users.filters.ordering_aria',
                            message: 'Sort users'
                        })}
                        onValueChange={handleOrderingChange}
                        items={localizedOrderingItems}
                    />
                    <div className="flex gap-2">
                        <Button density="compact" variant="secondary" onClick={handleSearch}>
                            <Trans id="common.search">Search</Trans>
                        </Button>
                        {(appliedQuery || roleFilter !== 'all' || ordering !== 'username') && (
                            <Button density="compact" variant="ghost" onClick={handleReset}>
                                <Trans id="common.reset">Reset</Trans>
                            </Button>
                        )}
                    </div>
                </div>

                {isUsersFetching && fetchedUsersData && (
                    <p className="mb-3 text-xs text-content-secondary">
                        <Trans id="settings.users.list.updating">Updating the user list…</Trans>
                    </p>
                )}

                <div className="overflow-hidden rounded-xl border border-line">
                    <div className="hidden grid-cols-[minmax(0,1.5fr)_110px_70px_100px_120px_44px] gap-4 bg-surface-subtle px-4 py-3 text-xs font-semibold text-content-secondary md:grid">
                        <span><Trans id="settings.users.field.user">User</Trans></span>
                        <span><Trans id="settings.users.field.role">Role</Trans></span>
                        <span><Trans id="settings.users.field.posts">Posts</Trans></span>
                        <span><Trans id="settings.users.field.status">Status</Trans></span>
                        <span><Trans id="settings.users.field.joined">Joined</Trans></span>
                        <span className="sr-only"><Trans id="settings.users.field.actions">Actions</Trans></span>
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

                                <div className="hidden gap-4 px-4 py-4 md:grid md:grid-cols-[minmax(0,1.5fr)_110px_70px_100px_120px_44px] md:items-center">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="truncate text-sm font-semibold text-content">{user.username}</p>
                                            {user.name && <span className="text-xs text-content-secondary">{user.name}</span>}
                                        </div>
                                        <p className="truncate text-xs text-content-secondary">
                                            {user.email || t({
                                                id: 'settings.users.field.no_email',
                                                message: 'No email address'
                                            })}
                                        </p>
                                    </div>

                                    <div className="space-y-1">
                                        {user.canChangeRole ? (
                                            <Select
                                                density="compact"
                                                value={user.role}
                                                ariaLabel={i18n._({
                                                    id: 'settings.users.role.select_aria',
                                                    message: 'Change role for {username}',
                                                    values: { username: user.username }
                                                })}
                                                onValueChange={(value) => void handleRoleChange(user, value as ManagedUserRole)}
                                                items={localizedRoleItems}
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
                                        <span>{formatDate(user.dateJoined, locale)}</span>
                                    </div>
                                    <div className="flex justify-end">
                                        {hasMemberActions(user) && (
                                            <button
                                                type="button"
                                                aria-expanded={expandedUserId === user.id}
                                                aria-controls={`managed-user-actions-${user.id}`}
                                                aria-label={i18n._({
                                                    id: 'settings.users.actions.toggle_label',
                                                    message: 'Manage {username}',
                                                    values: { username: user.username }
                                                })}
                                                onClick={() => handleUserToggle(user.id)}
                                                className="flex h-9 w-9 items-center justify-center rounded-lg text-content-hint transition-colors hover:bg-surface-subtle hover:text-content active:scale-95 motion-reduce:transform-none motion-reduce:transition-none">
                                                <ChevronDown
                                                    aria-hidden="true"
                                                    className={`h-4 w-4 transition-transform motion-reduce:transition-none ${expandedUserId === user.id ? 'rotate-180' : ''}`}
                                                />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {expandedUserId === user.id && hasMemberActions(user) && (
                                    <div
                                        id={`managed-user-actions-${user.id}`}
                                        className="hidden border-t border-line bg-surface-subtle/40 px-4 pb-4 md:block">
                                        <MemberActions user={user} />
                                    </div>
                                )}
                            </div>
                        ))}

                        {isUsersError ? (
                            <div className="px-4 py-8 text-center text-sm text-danger">
                                <Trans id="settings.users.list.error">
                                    Could not load the user list. Try again shortly.
                                </Trans>
                            </div>
                        ) : users.length === 0 && (
                            <div className="px-4 py-8 text-center text-sm text-content-secondary">
                                <Trans id="settings.users.list.empty">No users match your search.</Trans>
                            </div>
                        )}
                    </div>
                </div>

                <SettingsPagination
                    page={String(currentPage)}
                    lastPage={pagination.totalPages}
                    ariaLabel={t({
                        id: 'settings.users.pagination.aria',
                        message: 'User pages'
                    })}
                    onPageChange={value => handlePageMove(Number(value))}
                />
                {pagination.totalPages > 1 && (
                    <p className="mt-4 text-center text-sm text-content-secondary">
                        {i18n._({
                            id: 'settings.users.pagination.summary',
                            message: 'Showing {start}–{end} of {total} users',
                            values: {
                                start: (pagination.page - 1) * pagination.pageSize + 1,
                                end: Math.min(
                                    pagination.page * pagination.pageSize,
                                    pagination.total
                                ),
                                total: pagination.total
                            }
                        })}
                    </p>
                )}
            </Card>
        </div>
    );
};

export default UserManagementSetting;
