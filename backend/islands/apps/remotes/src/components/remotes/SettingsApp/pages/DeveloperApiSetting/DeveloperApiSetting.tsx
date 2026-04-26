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

const endpointItems = [
    {
        method: 'GET',
        path: '/api/developer/v1/me',
        description: '토큰과 계정 확인',
        scope: '토큰 확인'
    },
    {
        method: 'GET/POST',
        path: '/api/developer/v1/posts',
        description: '글 목록 조회와 새 글 생성',
        scope: 'posts:read / posts:write'
    },
    {
        method: 'GET/PATCH/DELETE',
        path: '/api/developer/v1/posts/{id}',
        description: '글 상세 조회, 수정, 삭제',
        scope: 'posts:read / posts:write'
    }
];

const requestExamples = [
    {
        title: '글 목록 조회',
        description: '읽기 권한 토큰으로 내 글을 최신 수정 순서로 가져옵니다.',
        code: `GET /api/developer/v1/posts?limit=10 HTTP/1.1
Authorization: Bearer blex_pat_...`
    },
    {
        title: '마크다운 임시 글 생성',
        description: '쓰기 권한 토큰으로 임시 글을 만듭니다.',
        code: `POST /api/developer/v1/posts HTTP/1.1
Authorization: Bearer blex_pat_...
Content-Type: application/json

{
  "status": "draft",
  "title": "새 글",
  "content": "# Hello",
  "content_type": "markdown",
  "tags": ["api", "mcp"]
}`
    }
];

const responseExamples = [
    {
        title: '성공 응답',
        description: '성공한 요청은 data에 결과가 들어갑니다.',
        code: `{
  "data": {
    "posts": [
      {
        "id": 25,
        "title": "새 글",
        "status": "draft",
        "content_type": "markdown",
        "tags": ["api", "mcp"]
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 17
    }
  }
}`
    },
    {
        title: '오류 응답',
        description: '실패한 요청은 error에 코드와 메시지가 들어갑니다.',
        code: `{
  "error": {
    "code": "auth.insufficient_scope",
    "message": "posts:write scope가 필요합니다."
  }
}`
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

    const [tokenName, setTokenName] = useState('MCP Client');
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
            setTokenName('MCP Client');
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
        <div className="space-y-8">
            <SettingsHeader
                title="개발자 API"
                description="외부 도구에서 내 블로그 글을 읽거나 작성할 수 있는 개인 API 토큰을 관리합니다."
            />

            <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-line bg-surface-subtle px-4 py-3">
                    <div className="text-xs font-semibold text-content-hint">활성 토큰</div>
                    <div className="mt-1 text-2xl font-semibold text-content">{activeTokenCount}</div>
                </div>
                <div className="rounded-xl border border-line bg-surface-subtle px-4 py-3">
                    <div className="text-xs font-semibold text-content-hint">전체 토큰</div>
                    <div className="mt-1 text-2xl font-semibold text-content">{tokens.length}</div>
                </div>
                <div className="rounded-xl border border-line bg-surface-subtle px-4 py-3">
                    <div className="text-xs font-semibold text-content-hint">기본 만료</div>
                    <div className="mt-1 text-2xl font-semibold text-content">90일</div>
                </div>
            </div>

            {createdToken && (
                <Card
                    title="새 토큰"
                    subtitle="토큰 원문은 지금 한 번만 표시됩니다."
                    icon={<i className="fas fa-key" />}>
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
                title="토큰 발급"
                subtitle="외부 도구가 사용할 권한과 만료 기간을 정합니다."
                icon={<i className="fas fa-plus" />}>
                <div className="space-y-5">
                    <Input
                        label="토큰 이름"
                        value={tokenName}
                        onChange={(event) => setTokenName(event.target.value)}
                        placeholder="MCP Client"
                    />

                    <div className="space-y-3">
                        <div>
                            <div className="text-sm font-semibold text-content">권한</div>
                            <p className="mt-1 text-xs leading-relaxed text-content-secondary">
                                필요한 작업에 맞는 최소 권한만 선택하세요.
                            </p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            {scopeOptions.map((scope) => {
                                const disabled = scope.requiresEditor && !isEditor;
                                return (
                                    <div key={scope.value} className="rounded-lg border border-line bg-surface-subtle p-4">
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
                        label="만료 기간"
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
                title="등록된 토큰"
                subtitle="이미 발급한 개발자 API 토큰입니다."
                icon={<i className="fas fa-list" />}>
                {tokens.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-line bg-surface-subtle p-8 text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-surface-elevated text-content-secondary">
                            <i className="fas fa-key" />
                        </div>
                        <h3 className="mt-4 text-sm font-semibold text-content">등록된 토큰이 없습니다</h3>
                        <p className="mt-2 text-sm text-content-secondary">새 토큰을 발급하면 이곳에서 상태를 확인할 수 있습니다.</p>
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

            <Card
                title="API 주소"
                subtitle="각 주소에서 필요한 권한을 확인하세요."
                icon={<i className="fas fa-code" />}>
                <div className="space-y-3">
                    {endpointItems.map((endpoint) => (
                        <div key={endpoint.path} className="flex flex-col gap-2 rounded-lg border border-line bg-surface-subtle p-4 sm:flex-row sm:items-center">
                            <span className="w-fit rounded-md bg-surface-elevated px-2 py-1 font-mono text-xs font-semibold text-content">
                                {endpoint.method}
                            </span>
                            <code className="min-w-0 flex-1 break-all font-mono text-xs text-content-secondary">
                                {endpoint.path}
                            </code>
                            <span className="w-fit rounded-md bg-surface-elevated px-2 py-1 font-mono text-xs text-content-secondary">
                                {endpoint.scope}
                            </span>
                            <span className="text-xs text-content-secondary">{endpoint.description}</span>
                        </div>
                    ))}
                </div>
            </Card>

            <Card
                title="요청과 응답"
                subtitle="토큰은 Authorization 헤더의 Bearer 값으로 보냅니다."
                icon={<i className="fas fa-terminal" />}>
                <div className="space-y-6">
                    <div className="rounded-lg border border-line bg-surface-subtle p-4">
                        <div className="text-sm font-semibold text-content">인증 헤더</div>
                        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                            <code className="min-w-0 flex-1 break-all rounded-md bg-surface-elevated px-3 py-2 font-mono text-xs text-content-secondary">
                                Authorization: Bearer blex_pat_...
                            </code>
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => handleCopy('Authorization: Bearer blex_pat_...')}
                                leftIcon={<i className="fas fa-copy" />}>
                                복사
                            </Button>
                        </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                        {requestExamples.map((example) => (
                            <div key={example.title} className="rounded-lg border border-line bg-surface-subtle p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="text-sm font-semibold text-content">{example.title}</div>
                                        <p className="mt-1 text-xs leading-relaxed text-content-secondary">{example.description}</p>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => handleCopy(example.code)}
                                        leftIcon={<i className="fas fa-copy" />}>
                                        복사
                                    </Button>
                                </div>
                                <pre className="mt-4 overflow-x-auto rounded-md bg-surface-elevated p-3 text-xs leading-relaxed text-content-secondary"><code>{example.code}</code></pre>
                            </div>
                        ))}
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                        {responseExamples.map((example) => (
                            <div key={example.title} className="rounded-lg border border-line bg-surface-subtle p-4">
                                <div className="text-sm font-semibold text-content">{example.title}</div>
                                <p className="mt-1 text-xs leading-relaxed text-content-secondary">{example.description}</p>
                                <pre className="mt-4 overflow-x-auto rounded-md bg-surface-elevated p-3 text-xs leading-relaxed text-content-secondary"><code>{example.code}</code></pre>
                            </div>
                        ))}
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default DeveloperApiSetting;
