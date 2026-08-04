import { useState } from 'react';
import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import {
    Ban,
    BookOpen,
    ChevronDown,
    Copy,
    KeyRound,
    Route,
    ShieldCheck
} from '@blex/ui/icons';
import { Button, Card, Checkbox, Input } from '~/components/shared';
import { useConfirm } from '~/hooks/useConfirm';
import {
    createDeveloperToken,
    getDeveloperTokens,
    revokeDeveloperToken,
    type CreatedDeveloperTokenData,
    type DeveloperTokenData,
    type DeveloperTokenScope
} from '~/lib/api/settings';
import { toast } from '~/utils/toast';
import { formatDateTime } from '~/i18n/formatters';
import { normalizeLocale } from '~/i18n/locale';
import { SettingsHeader } from '../../components';

type SettingsMode = 'user' | 'admin';

interface SettingsRouterContext {
    isEditor: boolean;
    isStaff: boolean;
    adminUrl?: string;
    settingsMode: SettingsMode;
    basePath: string;
}

const scopeOptions: Array<{
    value: DeveloperTokenScope;
    label: MessageDescriptor;
    description: MessageDescriptor;
    requiresEditor?: boolean;
}> = [
    {
        value: 'posts:read',
        label: msg({
            id: 'settings.developer_api.scope.posts_read.label',
            message: 'Read posts'
        }),
        description: msg({
            id: 'settings.developer_api.scope.posts_read.description',
            message: 'View your post list and post details.'
        })
    },
    {
        value: 'posts:write',
        label: msg({
            id: 'settings.developer_api.scope.posts_write.label',
            message: 'Write posts'
        }),
        description: msg({
            id: 'settings.developer_api.scope.posts_write.description',
            message: 'Create, edit, and publish your posts.'
        }),
        requiresEditor: true
    }
];

const headerLinkClassName = 'inline-flex min-h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-line-strong bg-surface-elevated px-3 py-1.5 text-xs font-semibold text-content shadow-sm transition-colors hover:border-line hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-line-strong/70 [@media(pointer:fine)]:min-h-9 sm:w-auto';

const isExpired = (token: DeveloperTokenData) => (
    token.expiresAt !== null && new Date(token.expiresAt).getTime() <= Date.now()
);

const tokenStatus = (token: DeveloperTokenData) => {
    if (token.revokedAt) {
        return {
            kind: 'revoked' as const,
            className: 'bg-danger-surface text-danger border-danger-line'
        };
    }

    if (isExpired(token)) {
        return {
            kind: 'expired' as const,
            className: 'bg-warning-surface text-warning border-warning-line'
        };
    }

    return {
        kind: 'active' as const,
        className: 'bg-success-surface text-success border-success-line'
    };
};

interface TokenListProps {
    tokens: DeveloperTokenData[];
    revokingTokenId?: number;
    onRevoke: (token: DeveloperTokenData) => void;
}

const TokenList = ({ tokens, revokingTokenId, onRevoke }: TokenListProps) => {
    const { i18n, t } = useLingui();
    const locale = normalizeLocale(i18n.locale);
    const noValue = t({
        id: 'common.none',
        message: 'None'
    });
    const formatTokenDateTime = (value: string | null) => formatDateTime(
        value ?? undefined,
        locale,
        value || noValue
    );
    const getScopeLabel = (scope: DeveloperTokenScope) => {
        if (scope === 'posts:read') {
            return t({
                id: 'settings.developer_api.scope.posts_read.label',
                message: 'Read posts'
            });
        }
        if (scope === 'posts:write') {
            return t({
                id: 'settings.developer_api.scope.posts_write.label',
                message: 'Write posts'
            });
        }
        return scope;
    };
    const getStatusLabel = (kind: ReturnType<typeof tokenStatus>['kind']) => {
        if (kind === 'revoked') {
            return t({
                id: 'settings.developer_api.status.revoked',
                message: 'Revoked'
            });
        }
        if (kind === 'expired') {
            return t({
                id: 'settings.developer_api.status.expired',
                message: 'Expired'
            });
        }
        return t({
            id: 'settings.developer_api.status.active',
            message: 'Active'
        });
    };

    return (
        <div className="divide-y divide-line rounded-xl border border-line">
            {tokens.map((token) => {
                const status = tokenStatus(token);
                const canRevoke = !token.revokedAt && !isExpired(token);
                const isRevoking = revokingTokenId === token.id;

                return (
                    <div key={token.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
                        <div className="min-w-0 flex-1 space-y-3">
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="text-sm font-semibold text-content">{token.name}</h3>
                                    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${status.className}`}>
                                        {getStatusLabel(status.kind)}
                                    </span>
                                </div>
                                <code className="mt-1 block break-all font-mono text-xs text-content-hint">
                                    blex_pat_{token.tokenPrefix}_...
                                </code>
                            </div>

                            <div className="flex flex-wrap gap-1.5">
                                {token.scopes.map((scope) => (
                                    <span key={scope} className="rounded-md bg-surface-subtle px-2 py-1 text-xs font-medium text-content-secondary">
                                        {getScopeLabel(scope)}
                                    </span>
                            ))}
                            </div>

                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-content-secondary">
                                <span>
                                    <span className="font-semibold text-content-hint">
                                        <Trans id="settings.developer_api.date.created">Created</Trans>
                                    </span>
                                    {' '}
                                    {formatTokenDateTime(token.createdAt)}
                                </span>
                                <span>
                                    <span className="font-semibold text-content-hint">
                                        <Trans id="settings.developer_api.date.expires">Expires</Trans>
                                    </span>
                                    {' '}
                                    {formatTokenDateTime(token.expiresAt)}
                                </span>
                                <span>
                                    <span className="font-semibold text-content-hint">
                                        <Trans id="settings.developer_api.date.last_used">Last used</Trans>
                                    </span>
                                    {' '}
                                    {formatTokenDateTime(token.lastUsedAt)}
                                </span>
                            </div>
                        </div>

                        {canRevoke && (
                        <Button
                            density="compact"
                            type="button"
                            variant="danger"
                            size="sm"
                            className="min-h-11! w-full [@media(pointer:fine)]:min-h-9! sm:w-auto"
                            isLoading={isRevoking}
                            onClick={() => onRevoke(token)}
                            leftIcon={!isRevoking ? <Ban aria-hidden className="h-4 w-4" /> : undefined}>
                            <Trans id="settings.developer_api.revoke.action">Revoke</Trans>
                        </Button>
                    )}
                    </div>
                );
            })}
        </div>
    );
};

const DeveloperApiSetting = () => {
    const { i18n, t } = useLingui();
    const queryClient = useQueryClient();
    const { confirm } = useConfirm();
    const router = useRouter();
    const { isEditor } = router.options.context as SettingsRouterContext;

    const [tokenName, setTokenName] = useState('');
    const [expiresInDays, setExpiresInDays] = useState('90');
    const [selectedScopes, setSelectedScopes] = useState<DeveloperTokenScope[]>(['posts:read']);
    const [createdToken, setCreatedToken] = useState<CreatedDeveloperTokenData | null>(null);

    const { data: tokens } = useSuspenseQuery({
        queryKey: ['developer-tokens'],
        queryFn: async () => {
            const { data } = await getDeveloperTokens();
            if (data.status === 'DONE') {
                return data.body.tokens;
            }
            throw new Error(data.errorMessage || t({
                id: 'settings.developer_api.load_failed',
                message: 'Could not load developer API tokens.'
            }));
        }
    });

    const createTokenMutation = useMutation({
        mutationFn: async () => {
            const parsedExpiresInDays = Number(expiresInDays);
            const { data } = await createDeveloperToken({
                name: tokenName.trim(),
                scopes: selectedScopes,
                expires_in_days: parsedExpiresInDays
            });
            return data;
        },
        onSuccess: (data) => {
            if (data.status !== 'DONE') {
                toast.error(data.errorMessage || t({
                    id: 'settings.developer_api.create.failed',
                    message: 'Could not create the token.'
                }));
                return;
            }

            setCreatedToken(data.body);
            setTokenName('');
            setExpiresInDays('90');
            setSelectedScopes(['posts:read']);
            void queryClient.invalidateQueries({ queryKey: ['developer-tokens'] });
            toast.success(t({
                id: 'settings.developer_api.create.success',
                message: 'Developer API token created.'
            }));
        },
        onError: () => {
            toast.error(t({
                id: 'settings.developer_api.create.error',
                message: 'An error occurred while creating the token.'
            }));
        }
    });

    const revokeTokenMutation = useMutation({
        mutationFn: async (tokenId: number) => {
            const { data } = await revokeDeveloperToken(tokenId);
            return data;
        },
        onSuccess: (data) => {
            if (data.status !== 'DONE') {
                toast.error(data.errorMessage || t({
                    id: 'settings.developer_api.revoke.failed',
                    message: 'Could not revoke the token.'
                }));
                return;
            }

            void queryClient.invalidateQueries({ queryKey: ['developer-tokens'] });
            toast.success(t({
                id: 'settings.developer_api.revoke.success',
                message: 'Developer API token revoked.'
            }));
        },
        onError: () => {
            toast.error(t({
                id: 'settings.developer_api.revoke.error',
                message: 'An error occurred while revoking the token.'
            }));
        }
    });

    const handleScopeChange = (scope: DeveloperTokenScope, checked: boolean) => {
        setSelectedScopes((current) => {
            if (checked) {
                return current.includes(scope) ? current : [...current, scope];
            }
            return current.filter((value) => value !== scope);
        });
    };

    const validateForm = () => {
        if (!tokenName.trim()) {
            toast.error(t({
                id: 'settings.developer_api.validation.name_required',
                message: 'Enter a token name.'
            }));
            return false;
        }

        if (selectedScopes.length === 0) {
            toast.error(t({
                id: 'settings.developer_api.validation.scope_required',
                message: 'Select at least one permission.'
            }));
            return false;
        }

        const parsedExpiresInDays = Number(expiresInDays);
        if (!Number.isInteger(parsedExpiresInDays) || parsedExpiresInDays < 1 || parsedExpiresInDays > 365) {
            toast.error(t({
                id: 'settings.developer_api.validation.expiry_range',
                message: 'Enter an expiration period between 1 and 365 days.'
            }));
            return false;
        }

        return true;
    };

    const handleCreateToken = () => {
        if (!validateForm()) return;
        createTokenMutation.mutate();
    };

    const handleCopy = async (value: string) => {
        try {
            await navigator.clipboard.writeText(value);
            toast.success(t({
                id: 'common.copy_success',
                message: 'Copied.'
            }));
        } catch {
            toast.error(t({
                id: 'common.copy_failed',
                message: 'Could not copy.'
            }));
        }
    };

    const handleRevokeToken = async (token: DeveloperTokenData) => {
        const confirmed = await confirm({
            title: t({
                id: 'settings.developer_api.revoke.title',
                message: 'Revoke API token'
            }),
            message: i18n._({
                id: 'settings.developer_api.revoke.message',
                message: 'Revoke "{name}"? A revoked token cannot be used again.',
                values: { name: token.name }
            }),
            confirmText: t({
                id: 'settings.developer_api.revoke.action',
                message: 'Revoke'
            }),
            variant: 'danger'
        });

        if (!confirmed) return;
        revokeTokenMutation.mutate(token.id);
    };

    const activeTokens = tokens.filter((token) => !token.revokedAt && !isExpired(token));
    const inactiveTokens = tokens.filter((token) => token.revokedAt || isExpired(token));
    const revokingTokenId = revokeTokenMutation.isPending
        ? revokeTokenMutation.variables
        : undefined;

    return (
        <div className="space-y-6">
            <SettingsHeader
                title={t({
                    id: 'settings.developer_api.title',
                    message: 'Developer API'
                })}
                description={t({
                    id: 'settings.developer_api.description',
                    message: 'Create and manage personal API tokens that let external tools read or write your posts.'
                })}
                actionPosition="right"
                action={(
                    <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
                        <a href="/docs/developer-api/quickstart" className={headerLinkClassName}>
                            <Route aria-hidden className="h-4 w-4" />
                            <Trans id="settings.developer_api.quickstart">Quickstart</Trans>
                        </a>
                        <a href="/api/developer/v1/docs" className={headerLinkClassName}>
                            <BookOpen aria-hidden className="h-4 w-4" />
                            <Trans id="settings.developer_api.docs">API docs</Trans>
                        </a>
                    </div>
                )}
            />

            <Card
                title={t({
                    id: 'settings.developer_api.create.title',
                    message: 'Create a token'
                })}
                subtitle={t({
                    id: 'settings.developer_api.create.description',
                    message: 'Choose a name, permissions, and expiration period for each external tool.'
                })}
                icon={<KeyRound aria-hidden className="h-4 w-4" />}>
                <div className="space-y-5">
                    <Input
                        density="compact"
                        label={t({
                            id: 'settings.developer_api.form.name',
                            message: 'Token name'
                        })}
                        value={tokenName}
                        onChange={(event) => setTokenName(event.target.value)}
                        placeholder={t({
                            id: 'settings.developer_api.form.name_placeholder',
                            message: 'For example: Personal automation, Raycast, deploy script'
                        })}
                        helperText={t({
                            id: 'settings.developer_api.form.name_help',
                            message: 'Use a name that will help you identify it later.'
                        })}
                        required
                    />

                    <div className="space-y-3">
                        <div>
                            <div className="text-sm font-semibold text-content">
                                <Trans id="settings.developer_api.form.permissions">Permissions</Trans>
                            </div>
                            <p className="mt-1 text-xs leading-relaxed text-content-secondary">
                                <Trans id="settings.developer_api.form.permissions_help">
                                    Select only the permissions this tool needs.
                                </Trans>
                            </p>
                        </div>
                        <div className="divide-y divide-line rounded-lg border border-line">
                            {scopeOptions.map((scope) => {
                                const disabled = scope.requiresEditor && !isEditor;
                                return (
                                    <div key={scope.value} className="p-4">
                                        <Checkbox
                                            checked={selectedScopes.includes(scope.value)}
                                            onCheckedChange={(checked) => handleScopeChange(scope.value, checked)}
                                            disabled={disabled}
                                            label={i18n._(scope.label)}
                                            description={disabled
                                                ? t({
                                                    id: 'settings.developer_api.scope.author_required',
                                                    message: 'Author access is required.'
                                                })
                                                : i18n._(scope.description)}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <Input
                        density="compact"
                        label={t({
                            id: 'settings.developer_api.form.expiration_days',
                            message: 'Expires in (days)'
                        })}
                        type="number"
                        min={1}
                        max={365}
                        value={expiresInDays}
                        onChange={(event) => setExpiresInDays(event.target.value)}
                        helperText={t({
                            id: 'settings.developer_api.form.expiration_help',
                            message: 'Choose a value from 1 to 365 days.'
                        })}
                    />

                    <div className="flex gap-3 rounded-xl border border-line bg-surface-subtle p-4">
                        <ShieldCheck
                            aria-hidden
                            className="mt-0.5 h-5 w-5 shrink-0 text-content-secondary"
                        />
                        <p className="text-xs leading-relaxed text-content-secondary">
                            <Trans id="settings.developer_api.security_notice">
                                The full token is shown only once, immediately after creation. Grant the minimum permissions, choose the shortest useful lifetime, and store it securely.
                            </Trans>
                        </p>
                    </div>

                    <div className="flex justify-end">
                        <Button
                            density="compact"
                            type="button"
                            variant="primary"
                            className="min-h-11! w-full [@media(pointer:fine)]:min-h-10! sm:w-auto"
                            isLoading={createTokenMutation.isPending}
                            onClick={handleCreateToken}
                            leftIcon={!createTokenMutation.isPending ? <KeyRound aria-hidden className="h-4 w-4" /> : undefined}>
                            {createTokenMutation.isPending
                                ? <Trans id="settings.developer_api.create.creating">Creating…</Trans>
                                : <Trans id="settings.developer_api.create.action">Create token</Trans>}
                        </Button>
                    </div>
                </div>
            </Card>

            {createdToken && (
                <section aria-live="polite">
                    <Card
                        title={t({
                            id: 'settings.developer_api.created.title',
                            message: 'Copy your token now'
                        })}
                        subtitle={t({
                            id: 'settings.developer_api.created.description',
                            message: 'The full value is shown only once on this screen.'
                        })}
                        icon={<Copy aria-hidden className="h-4 w-4" />}>
                        <div className="space-y-4">
                            <div className="rounded-xl border border-warning-line bg-warning-surface p-4">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                    <code className="min-w-0 flex-1 break-all font-mono text-sm text-content">
                                        {createdToken.token}
                                    </code>
                                    <Button
                                        density="compact"
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        className="min-h-11! w-full [@media(pointer:fine)]:min-h-9! sm:w-auto"
                                        onClick={() => handleCopy(createdToken.token)}
                                        leftIcon={<Copy aria-hidden className="h-4 w-4" />}>
                                        <Trans id="common.copy">Copy</Trans>
                                    </Button>
                                </div>
                            </div>
                            <p className="text-xs leading-relaxed text-content-secondary">
                                <Trans id="settings.developer_api.created.warning">
                                    You cannot view it again after refreshing or leaving this screen. If it is lost or exposed, revoke it below and create a new one immediately.
                                </Trans>
                            </p>
                        </div>
                    </Card>
                </section>
            )}

            <Card
                title={i18n._({
                    id: 'settings.developer_api.active.title',
                    message: 'Active tokens ({count})',
                    values: { count: activeTokens.length }
                })}
                subtitle={t({
                    id: 'settings.developer_api.active.description',
                    message: 'Review tokens that can currently be used and revoke them whenever needed.'
                })}>
                <div className="space-y-5">
                    {activeTokens.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-content-secondary">
                            <Trans id="settings.developer_api.active.empty">
                                There are no active tokens. Create one above when you need it.
                            </Trans>
                        </p>
                    ) : (
                        <TokenList
                            tokens={activeTokens}
                            revokingTokenId={revokingTokenId}
                            onRevoke={handleRevokeToken}
                        />
                    )}

                    {inactiveTokens.length > 0 && (
                        <details className="group border-t border-line pt-3">
                            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-2 text-sm font-semibold text-content-secondary transition-colors hover:bg-surface-subtle hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-strong [&::-webkit-details-marker]:hidden">
                                <span>
                                    {i18n._({
                                        id: 'settings.developer_api.inactive.title',
                                        message: 'Expired and revoked ({count})',
                                        values: { count: inactiveTokens.length }
                                    })}
                                </span>
                                <ChevronDown
                                    aria-hidden
                                    className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
                                />
                            </summary>
                            <div className="mt-3">
                                <TokenList
                                    tokens={inactiveTokens}
                                    revokingTokenId={revokingTokenId}
                                    onRevoke={handleRevokeToken}
                                />
                            </div>
                        </details>
                    )}
                </div>
            </Card>
        </div>
    );
};

export default DeveloperApiSetting;
