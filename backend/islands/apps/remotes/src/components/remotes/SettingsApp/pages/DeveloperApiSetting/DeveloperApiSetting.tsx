import { useState } from 'react';
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
    label: string;
    description: string;
    requiresEditor?: boolean;
}> = [
    {
        value: 'posts:read',
        label: '포스트 읽기',
        description: '내 포스트 목록과 상세 내용을 조회합니다.'
    },
    {
        value: 'posts:write',
        label: '포스트 작성',
        description: '내 포스트를 만들고 수정하고 발행합니다.',
        requiresEditor: true
    }
];

const headerLinkClassName = 'inline-flex min-h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-line-strong bg-surface-elevated px-3 py-1.5 text-xs font-semibold text-content shadow-sm transition-colors hover:border-line hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-line-strong/70 [@media(pointer:fine)]:min-h-9 sm:w-auto';

const formatDateTime = (value: string | null) => {
    if (!value) return '없음';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
};

const isExpired = (token: DeveloperTokenData) => (
    token.expiresAt !== null && new Date(token.expiresAt).getTime() <= Date.now()
);

const tokenStatus = (token: DeveloperTokenData) => {
    if (token.revokedAt) {
        return {
            label: '폐기됨',
            className: 'bg-danger-surface text-danger border-danger-line'
        };
    }

    if (isExpired(token)) {
        return {
            label: '만료됨',
            className: 'bg-warning-surface text-warning border-warning-line'
        };
    }

    return {
        label: '활성',
        className: 'bg-success-surface text-success border-success-line'
    };
};

const scopeLabel = (scope: DeveloperTokenScope) => {
    if (scope === 'posts:read') return '포스트 읽기';
    if (scope === 'posts:write') return '포스트 작성';
    return scope;
};

interface TokenListProps {
    tokens: DeveloperTokenData[];
    revokingTokenId?: number;
    onRevoke: (token: DeveloperTokenData) => void;
}

const TokenList = ({ tokens, revokingTokenId, onRevoke }: TokenListProps) => (
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
                                    {status.label}
                                </span>
                            </div>
                            <code className="mt-1 block break-all font-mono text-xs text-content-hint">
                                blex_pat_{token.tokenPrefix}_...
                            </code>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                            {token.scopes.map((scope) => (
                                <span key={scope} className="rounded-md bg-surface-subtle px-2 py-1 text-xs font-medium text-content-secondary">
                                    {scopeLabel(scope)}
                                </span>
                            ))}
                        </div>

                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-content-secondary">
                            <span>
                                <span className="font-semibold text-content-hint">생성</span>
                                {' '}
                                {formatDateTime(token.createdAt)}
                            </span>
                            <span>
                                <span className="font-semibold text-content-hint">만료</span>
                                {' '}
                                {formatDateTime(token.expiresAt)}
                            </span>
                            <span>
                                <span className="font-semibold text-content-hint">마지막 사용</span>
                                {' '}
                                {formatDateTime(token.lastUsedAt)}
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
                            폐기
                        </Button>
                    )}
                </div>
            );
        })}
    </div>
);

const DeveloperApiSetting = () => {
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
            throw new Error(data.errorMessage || '개발자 API 토큰을 불러오는데 실패했습니다.');
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
                toast.error(data.errorMessage || '토큰 발급에 실패했습니다.');
                return;
            }

            setCreatedToken(data.body);
            setTokenName('');
            setExpiresInDays('90');
            setSelectedScopes(['posts:read']);
            void queryClient.invalidateQueries({ queryKey: ['developer-tokens'] });
            toast.success('개발자 API 토큰이 발급되었습니다.');
        },
        onError: () => {
            toast.error('토큰 발급 중 오류가 발생했습니다.');
        }
    });

    const revokeTokenMutation = useMutation({
        mutationFn: async (tokenId: number) => {
            const { data } = await revokeDeveloperToken(tokenId);
            return data;
        },
        onSuccess: (data) => {
            if (data.status !== 'DONE') {
                toast.error(data.errorMessage || '토큰 폐기에 실패했습니다.');
                return;
            }

            void queryClient.invalidateQueries({ queryKey: ['developer-tokens'] });
            toast.success('개발자 API 토큰이 폐기되었습니다.');
        },
        onError: () => {
            toast.error('토큰 폐기 중 오류가 발생했습니다.');
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
            toast.error('토큰 이름을 입력해주세요.');
            return false;
        }

        if (selectedScopes.length === 0) {
            toast.error('최소 하나의 권한을 선택해주세요.');
            return false;
        }

        const parsedExpiresInDays = Number(expiresInDays);
        if (!Number.isInteger(parsedExpiresInDays) || parsedExpiresInDays < 1 || parsedExpiresInDays > 365) {
            toast.error('만료 기간은 1일부터 365일 사이로 입력해주세요.');
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
            toast.success('복사되었습니다.');
        } catch {
            toast.error('복사에 실패했습니다.');
        }
    };

    const handleRevokeToken = async (token: DeveloperTokenData) => {
        const confirmed = await confirm({
            title: 'API 토큰 폐기',
            message: `"${token.name}" 토큰을 폐기할까요? 폐기된 토큰은 다시 사용할 수 없습니다.`,
            confirmText: '폐기',
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
                title="개발자 API"
                description="외부 도구에서 내 포스트를 읽거나 작성할 수 있는 개인 API 토큰을 발급하고 관리합니다."
                actionPosition="right"
                action={(
                    <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
                        <a href="/docs/developer-api/quickstart" className={headerLinkClassName}>
                            <Route aria-hidden className="h-4 w-4" />
                            빠른 시작
                        </a>
                        <a href="/api/developer/v1/docs" className={headerLinkClassName}>
                            <BookOpen aria-hidden className="h-4 w-4" />
                            API 문서
                        </a>
                    </div>
                )}
            />

            <Card
                title="새 토큰 발급"
                subtitle="이름, 권한, 만료 기간을 정하고 외부 도구별로 발급합니다."
                icon={<KeyRound aria-hidden className="h-4 w-4" />}>
                <div className="space-y-5">
                    <Input
                        density="compact"
                        label="토큰 이름"
                        value={tokenName}
                        onChange={(event) => setTokenName(event.target.value)}
                        placeholder="예: 개인 자동화, Raycast, 배포 스크립트"
                        helperText="나중에 구분할 수 있는 이름으로 적어주세요."
                        required
                    />

                    <div className="space-y-3">
                        <div>
                            <div className="text-sm font-semibold text-content">권한</div>
                            <p className="mt-1 text-xs leading-relaxed text-content-secondary">
                                필요한 작업에 맞는 최소 권한만 선택하세요.
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
                                            label={scope.label}
                                            description={disabled ? '작가 권한이 필요합니다.' : scope.description}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <Input
                        density="compact"
                        label="만료 기간(일)"
                        type="number"
                        min={1}
                        max={365}
                        value={expiresInDays}
                        onChange={(event) => setExpiresInDays(event.target.value)}
                        helperText="1일부터 365일까지 설정할 수 있습니다."
                    />

                    <div className="flex gap-3 rounded-xl border border-line bg-surface-subtle p-4">
                        <ShieldCheck
                            aria-hidden
                            className="mt-0.5 h-5 w-5 shrink-0 text-content-secondary"
                        />
                        <p className="text-xs leading-relaxed text-content-secondary">
                            전체 토큰 값은 발급 직후 한 번만 표시됩니다. 필요한 최소 권한과 사용 기간만 선택하고 안전한 곳에 보관하세요.
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
                            {createTokenMutation.isPending ? '발급 중...' : '토큰 발급'}
                        </Button>
                    </div>
                </div>
            </Card>

            {createdToken && (
                <section aria-live="polite">
                    <Card
                        title="지금 토큰을 복사하세요"
                        subtitle="전체 값은 이 화면에서 한 번만 표시됩니다."
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
                                        복사
                                    </Button>
                                </div>
                            </div>
                            <p className="text-xs leading-relaxed text-content-secondary">
                                새로고침하거나 이 화면을 벗어나면 다시 확인할 수 없습니다. 분실하거나 노출했다면 아래에서 즉시 폐기하고 새로 발급하세요.
                            </p>
                        </div>
                    </Card>
                </section>
            )}

            <Card
                title={`활성 토큰 (${activeTokens.length})`}
                subtitle="현재 사용할 수 있는 토큰을 확인하고 필요할 때 즉시 폐기합니다.">
                <div className="space-y-5">
                    {activeTokens.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-content-secondary">
                            현재 사용할 수 있는 토큰이 없습니다. 필요하면 위에서 새 토큰을 발급하세요.
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
                                <span>만료·폐기 기록 ({inactiveTokens.length})</span>
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
