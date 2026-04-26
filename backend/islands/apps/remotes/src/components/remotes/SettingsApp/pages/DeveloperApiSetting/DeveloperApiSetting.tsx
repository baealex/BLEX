import { useState } from 'react';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
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
        label: '글 읽기',
        description: '내 글 목록과 상세 내용을 조회합니다.'
    },
    {
        value: 'posts:write',
        label: '글 작성',
        description: '내 글을 만들고 수정하고 발행합니다.',
        requiresEditor: true
    }
];

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
    if (scope === 'posts:read') return '글 읽기';
    if (scope === 'posts:write') return '글 작성';
    return scope;
};

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

    const activeTokenCount = tokens.filter((token) => !token.revokedAt && !isExpired(token)).length;

    return (
        <div className="space-y-6">
            <SettingsHeader
                title="개발자 API"
                description="외부 도구에서 내 글을 읽거나 작성할 수 있는 개인 API 토큰을 발급하고 관리합니다."
                actionPosition="right"
                action={(
                    <a href="/docs/developer-api">
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            leftIcon={<i className="fas fa-book-open" />}>
                            API 문서
                        </Button>
                    </a>
                )}
            />

            <section className="rounded-2xl border border-line bg-surface-subtle px-5 py-4">
                <div className="grid gap-4 md:grid-cols-3">
                    <div>
                        <div className="text-xs font-semibold text-content-hint">용도</div>
                        <p className="mt-1 text-sm font-semibold text-content">외부 도구 연결</p>
                        <p className="mt-1 text-xs leading-relaxed text-content-secondary">
                            자동화 도구나 개인 클라이언트에서 내 글 API를 사용할 때 발급합니다.
                        </p>
                    </div>
                    <div>
                        <div className="text-xs font-semibold text-content-hint">권한</div>
                        <p className="mt-1 text-sm font-semibold text-content">필요한 작업만 허용</p>
                        <p className="mt-1 text-xs leading-relaxed text-content-secondary">
                            읽기와 작성 권한을 분리해서 토큰마다 접근 범위를 제한합니다.
                        </p>
                    </div>
                    <div>
                        <div className="text-xs font-semibold text-content-hint">보관</div>
                        <p className="mt-1 text-sm font-semibold text-content">전체 토큰은 한 번만 표시</p>
                        <p className="mt-1 text-xs leading-relaxed text-content-secondary">
                            발급 직후 복사해두고, 분실하면 새 토큰을 발급한 뒤 기존 토큰을 폐기하세요.
                        </p>
                    </div>
                </div>
            </section>

            {createdToken && (
                <Card
                    title="토큰이 발급되었습니다"
                    subtitle="전체 토큰 값은 지금 한 번만 확인할 수 있습니다.">
                    <div className="space-y-4">
                        <div className="rounded-lg border border-line bg-surface-subtle p-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                <code className="min-w-0 flex-1 break-all font-mono text-sm text-content">
                                    {createdToken.token}
                                </code>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => handleCopy(createdToken.token)}
                                    leftIcon={<i className="fas fa-copy" />}>
                                    복사
                                </Button>
                            </div>
                        </div>
                        <p className="text-xs leading-relaxed text-content-secondary">
                            이 값을 저장하지 않으면 다시 확인할 수 없습니다. 분실한 경우 새 토큰을 발급하고 기존 토큰을 폐기하세요.
                        </p>
                    </div>
                </Card>
            )}

            <Card
                title="새 토큰 발급"
                subtitle="외부 도구 하나당 토큰 하나를 발급하면 추적과 폐기가 쉽습니다.">
                <div className="space-y-5">
                    <Input
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
                                            description={disabled ? '편집자 권한이 필요합니다.' : scope.description}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <Input
                        label="만료 기간(일)"
                        type="number"
                        min={1}
                        max={365}
                        value={expiresInDays}
                        onChange={(event) => setExpiresInDays(event.target.value)}
                        helperText="1일부터 365일까지 설정할 수 있습니다."
                    />

                    <div className="flex justify-end">
                        <Button
                            type="button"
                            variant="primary"
                            isLoading={createTokenMutation.isPending}
                            onClick={handleCreateToken}
                            leftIcon={!createTokenMutation.isPending ? <i className="fas fa-key" /> : undefined}>
                            {createTokenMutation.isPending ? '발급 중...' : '토큰 발급'}
                        </Button>
                    </div>
                </div>
            </Card>

            <Card
                title="발급된 토큰"
                subtitle={tokens.length === 0 ? '아직 발급된 토큰이 없습니다.' : `활성 ${activeTokenCount}개 / 전체 ${tokens.length}개`}>
                {tokens.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-line px-4 py-6 text-center">
                        <h3 className="text-sm font-semibold text-content">발급된 토큰이 없습니다</h3>
                        <p className="mt-2 text-sm text-content-secondary">
                            외부 도구를 연결할 때 새 토큰을 발급하세요.
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-line rounded-xl border border-line">
                        {tokens.map((token) => {
                            const status = tokenStatus(token);
                            const canRevoke = !token.revokedAt && !isExpired(token);
                            return (
                                <div key={token.id} className="p-4">
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                        <div className="min-w-0 flex-1 space-y-3">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h3 className="text-sm font-semibold text-content">{token.name}</h3>
                                                <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold ${status.className}`}>
                                                    {status.label}
                                                </span>
                                            </div>
                                            <code className="block break-all rounded-md bg-surface-subtle px-3 py-2 font-mono text-xs text-content-secondary">
                                                blex_pat_{token.tokenPrefix}_...
                                            </code>
                                            <div className="flex flex-wrap gap-2">
                                                {token.scopes.map((scope) => (
                                                    <span key={scope} className="rounded-md bg-surface-subtle px-2 py-1 text-xs font-medium text-content-secondary">
                                                        {scopeLabel(scope)}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="grid gap-2 text-xs text-content-secondary sm:grid-cols-3 lg:w-[420px]">
                                            <div>
                                                <div className="font-semibold text-content">생성</div>
                                                <div className="mt-1">{formatDateTime(token.createdAt)}</div>
                                            </div>
                                            <div>
                                                <div className="font-semibold text-content">만료</div>
                                                <div className="mt-1">{formatDateTime(token.expiresAt)}</div>
                                            </div>
                                            <div>
                                                <div className="font-semibold text-content">마지막 사용</div>
                                                <div className="mt-1">{formatDateTime(token.lastUsedAt)}</div>
                                            </div>
                                        </div>
                                    </div>
                                    {canRevoke && (
                                        <div className="mt-4 flex justify-end">
                                            <Button
                                                type="button"
                                                variant="danger"
                                                size="sm"
                                                isLoading={revokeTokenMutation.isPending && revokeTokenMutation.variables === token.id}
                                                onClick={() => handleRevokeToken(token)}
                                                leftIcon={!(revokeTokenMutation.isPending && revokeTokenMutation.variables === token.id) ? <i className="fas fa-ban" /> : undefined}>
                                                폐기
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </Card>
        </div>
    );
};

export default DeveloperApiSetting;
