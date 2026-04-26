import { useState } from 'react';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Link, useRouter } from '@tanstack/react-router';
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

type Requirement = '필수' | '선택' | '조건부';

interface ApiField {
    name: string;
    type: string;
    requirement: Requirement;
    description: string;
}

interface ApiExample {
    title: string;
    code: string;
}

interface ApiOperation {
    id: string;
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    path: string;
    summary: string;
    scope: string;
    description: string;
    successStatus: string;
    pathParams?: ApiField[];
    queryParams?: ApiField[];
    requestBody?: ApiField[];
    responseBody: ApiField[];
    errors: string[];
    example?: ApiExample;
}

const postSummaryFields: ApiField[] = [
    {
        name: 'id',
        type: 'number',
        requirement: '필수',
        description: '글 ID입니다.'
    },
    {
        name: 'title',
        type: 'string',
        requirement: '필수',
        description: '글 제목입니다.'
    },
    {
        name: 'subtitle',
        type: 'string',
        requirement: '필수',
        description: '부제목입니다. 값이 없으면 빈 문자열입니다.'
    },
    {
        name: 'url',
        type: 'string',
        requirement: '필수',
        description: '글 URL slug입니다.'
    },
    {
        name: 'public_url',
        type: 'string',
        requirement: '필수',
        description: '공개 페이지 경로입니다.'
    },
    {
        name: 'status',
        type: 'draft | published | scheduled | hidden',
        requirement: '필수',
        description: '현재 글 상태입니다.'
    },
    {
        name: 'content_type',
        type: 'html | markdown',
        requirement: '필수',
        description: '본문 저장 형식입니다.'
    },
    {
        name: 'tags',
        type: 'string[]',
        requirement: '필수',
        description: '태그 목록입니다.'
    },
    {
        name: 'series',
        type: '{ id, name, url } | null',
        requirement: '필수',
        description: '연결된 시리즈 정보입니다.'
    },
    {
        name: 'is_hidden',
        type: 'boolean',
        requirement: '필수',
        description: '숨김 여부입니다.'
    },
    {
        name: 'is_advertise',
        type: 'boolean',
        requirement: '필수',
        description: '광고/홍보 표시 여부입니다.'
    },
    {
        name: 'created_at',
        type: 'ISO datetime',
        requirement: '필수',
        description: '생성 시각입니다.'
    },
    {
        name: 'updated_at',
        type: 'ISO datetime',
        requirement: '필수',
        description: '마지막 수정 시각입니다.'
    },
    {
        name: 'published_at',
        type: 'ISO datetime | null',
        requirement: '필수',
        description: '발행 시각입니다. 임시 글이면 null입니다.'
    }
];

const postDetailFields: ApiField[] = [
    ...postSummaryFields,
    {
        name: 'description',
        type: 'string',
        requirement: '필수',
        description: '검색/공유용 설명입니다.'
    },
    {
        name: 'content',
        type: 'string',
        requirement: '필수',
        description: '원본 본문입니다. markdown 글은 마크다운 원문이 반환됩니다.'
    },
    {
        name: 'rendered_html',
        type: 'string',
        requirement: '필수',
        description: '렌더링된 HTML 본문입니다.'
    },
    {
        name: 'read_time',
        type: 'number',
        requirement: '필수',
        description: '예상 읽기 시간입니다.'
    }
];

const postIdPathParams: ApiField[] = [
    {
        name: 'id',
        type: 'number',
        requirement: '필수',
        description: '대상 글 ID입니다.'
    }
];

const postMutationBodyFields: ApiField[] = [
    {
        name: 'title',
        type: 'string',
        requirement: '조건부',
        description: 'published/scheduled 생성에는 필요합니다. draft는 생략 시 제목 없음으로 저장됩니다.'
    },
    {
        name: 'content',
        type: 'string',
        requirement: '조건부',
        description: 'published/scheduled 생성에는 필요합니다. markdown이면 마크다운 원문을 보냅니다.'
    },
    {
        name: 'content_type',
        type: 'html | markdown',
        requirement: '선택',
        description: '기본값은 html입니다.'
    },
    {
        name: 'subtitle',
        type: 'string',
        requirement: '선택',
        description: '글 부제목입니다.'
    },
    {
        name: 'description',
        type: 'string',
        requirement: '선택',
        description: '검색/공유용 설명입니다. 생략하면 본문에서 생성됩니다.'
    },
    {
        name: 'tags',
        type: 'string[] | string',
        requirement: '선택',
        description: '태그 목록입니다. tag 이름으로도 보낼 수 있습니다.'
    },
    {
        name: 'series_id',
        type: 'number',
        requirement: '선택',
        description: '연결할 내 시리즈 ID입니다.'
    },
    {
        name: 'series_url',
        type: 'string',
        requirement: '선택',
        description: '연결할 내 시리즈 URL입니다. series_id보다 우선합니다.'
    },
    {
        name: 'slug',
        type: 'string',
        requirement: '선택',
        description: '사용할 URL slug입니다. url 이름으로도 보낼 수 있습니다.'
    },
    {
        name: 'is_hidden',
        type: 'boolean',
        requirement: '선택',
        description: '발행된 글을 숨김 상태로 만들지 여부입니다.'
    },
    {
        name: 'is_advertise',
        type: 'boolean',
        requirement: '선택',
        description: '광고/홍보 표시 여부입니다.'
    }
];

const apiOperations: ApiOperation[] = [
    {
        id: 'get-me',
        method: 'GET',
        path: '/api/developer/v1/me',
        summary: '토큰과 계정 확인',
        scope: '유효한 토큰',
        description: '현재 토큰이 어떤 계정과 권한에 연결되어 있는지 확인합니다.',
        successStatus: '200',
        responseBody: [
            {
                name: 'user',
                type: '{ id, username, name, email, is_editor }',
                requirement: '필수',
                description: '토큰 소유자 정보입니다.'
            },
            {
                name: 'token',
                type: '{ id, name, token_prefix, scopes }',
                requirement: '필수',
                description: '요청에 사용된 토큰 정보입니다. 토큰 원문은 반환하지 않습니다.'
            }
        ],
        errors: [
            '401 auth.missing_token: Authorization 헤더가 없습니다.',
            '401 auth.invalid_token: 토큰이 잘못되었거나 만료/폐기되었습니다.'
        ],
        example: {
            title: '토큰 확인',
            code: `GET /api/developer/v1/me HTTP/1.1
Authorization: Bearer blex_pat_...`
        }
    },
    {
        id: 'list-posts',
        method: 'GET',
        path: '/api/developer/v1/posts',
        summary: '글 목록 조회',
        scope: 'posts:read',
        description: '내 글 목록을 최신 수정 순서로 조회합니다.',
        successStatus: '200',
        queryParams: [
            {
                name: 'status',
                type: 'draft | published | scheduled | hidden',
                requirement: '선택',
                description: '상태별로 필터링합니다. 생략하면 전체를 조회합니다.'
            },
            {
                name: 'page',
                type: 'number',
                requirement: '선택',
                description: '페이지 번호입니다. 기본값은 1입니다.'
            },
            {
                name: 'limit',
                type: 'number',
                requirement: '선택',
                description: '페이지당 개수입니다. 기본값은 20, 최대값은 100입니다.'
            }
        ],
        responseBody: [
            {
                name: 'posts',
                type: 'PostSummary[]',
                requirement: '필수',
                description: '글 요약 목록입니다.'
            },
            {
                name: 'pagination',
                type: '{ page, limit, total }',
                requirement: '필수',
                description: '현재 페이지와 전체 개수입니다.'
            }
        ],
        errors: [
            '401 auth.missing_token: Authorization 헤더가 없습니다.',
            '403 auth.insufficient_scope: posts:read 권한이 없습니다.',
            '400 post.invalid_status: 지원하지 않는 status입니다.'
        ],
        example: {
            title: '글 목록 조회',
            code: `GET /api/developer/v1/posts?status=draft&page=1&limit=10 HTTP/1.1
Authorization: Bearer blex_pat_...`
        }
    },
    {
        id: 'create-post',
        method: 'POST',
        path: '/api/developer/v1/posts',
        summary: '글 생성',
        scope: 'posts:write',
        description: '임시 글, 즉시 발행 글, 예약 발행 글을 생성합니다.',
        successStatus: '201',
        requestBody: [
            {
                name: 'status',
                type: 'draft | published | scheduled',
                requirement: '선택',
                description: '기본값은 draft입니다. scheduled는 published_at이 필요합니다.'
            },
            {
                name: 'published_at',
                type: 'ISO datetime',
                requirement: '조건부',
                description: 'status가 scheduled일 때 필요합니다.'
            },
            ...postMutationBodyFields
        ],
        responseBody: postDetailFields,
        errors: [
            '403 auth.insufficient_scope: posts:write 권한이 없습니다.',
            '400 post.missing_published_at: 예약 발행 시각이 없습니다.',
            '422 post.*: 제목, 본문, URL, 태그 등 글 검증에 실패했습니다.'
        ],
        example: {
            title: '마크다운 임시 글 생성',
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
    },
    {
        id: 'get-post',
        method: 'GET',
        path: '/api/developer/v1/posts/{id}',
        summary: '글 상세 조회',
        scope: 'posts:read',
        description: '내 글 하나의 원문과 렌더링 HTML을 조회합니다.',
        successStatus: '200',
        pathParams: postIdPathParams,
        responseBody: postDetailFields,
        errors: [
            '403 auth.insufficient_scope: posts:read 권한이 없습니다.',
            '404 post.not_found: 내 글에서 해당 ID를 찾을 수 없습니다.'
        ],
        example: {
            title: '글 상세 조회',
            code: `GET /api/developer/v1/posts/25 HTTP/1.1
Authorization: Bearer blex_pat_...`
        }
    },
    {
        id: 'update-post',
        method: 'PATCH',
        path: '/api/developer/v1/posts/{id}',
        summary: '글 수정',
        scope: 'posts:write',
        description: '전달한 필드만 수정합니다. expected_updated_at으로 충돌을 감지할 수 있습니다.',
        successStatus: '200',
        pathParams: postIdPathParams,
        requestBody: [
            {
                name: 'expected_updated_at',
                type: 'ISO datetime',
                requirement: '선택',
                description: '현재 updated_at과 다르면 409를 반환합니다.'
            },
            ...postMutationBodyFields
        ],
        responseBody: postDetailFields,
        errors: [
            '403 auth.insufficient_scope: posts:write 권한이 없습니다.',
            '404 post.not_found: 내 글에서 해당 ID를 찾을 수 없습니다.',
            '409 post.version_conflict: expected_updated_at이 현재 값과 다릅니다.',
            '422 post.*: 글 검증에 실패했습니다.'
        ],
        example: {
            title: '글 제목과 본문 수정',
            code: `PATCH /api/developer/v1/posts/25 HTTP/1.1
Authorization: Bearer blex_pat_...
Content-Type: application/json

{
  "expected_updated_at": "2026-04-20T11:37:35.799973+00:00",
  "title": "수정한 제목",
  "content": "# Updated"
}`
        }
    },
    {
        id: 'delete-post',
        method: 'DELETE',
        path: '/api/developer/v1/posts/{id}',
        summary: '글 삭제',
        scope: 'posts:write',
        description: '내 글을 삭제합니다. dry_run=true로 삭제 가능 여부만 확인할 수 있습니다.',
        successStatus: '200',
        pathParams: postIdPathParams,
        queryParams: [
            {
                name: 'dry_run',
                type: 'boolean',
                requirement: '선택',
                description: 'true면 실제 삭제 없이 can_delete와 post 요약을 반환합니다.'
            }
        ],
        responseBody: [
            {
                name: 'deleted',
                type: 'boolean',
                requirement: '조건부',
                description: '실제 삭제 요청일 때 true로 반환됩니다.'
            },
            {
                name: 'id',
                type: 'number',
                requirement: '조건부',
                description: '삭제된 글 ID입니다.'
            },
            {
                name: 'can_delete',
                type: 'boolean',
                requirement: '조건부',
                description: 'dry_run=true일 때 삭제 가능 여부입니다.'
            },
            {
                name: 'post',
                type: 'PostSummary',
                requirement: '조건부',
                description: 'dry_run=true일 때 대상 글 요약입니다.'
            }
        ],
        errors: [
            '403 auth.insufficient_scope: posts:write 권한이 없습니다.',
            '404 post.not_found: 내 글에서 해당 ID를 찾을 수 없습니다.'
        ],
        example: {
            title: '삭제 가능 여부 확인',
            code: `DELETE /api/developer/v1/posts/25?dry_run=true HTTP/1.1
Authorization: Bearer blex_pat_...`
        }
    },
    {
        id: 'publish-post',
        method: 'POST',
        path: '/api/developer/v1/posts/{id}/publish',
        summary: '임시 글 발행',
        scope: 'posts:write',
        description: '임시 글을 즉시 발행하거나 published_at으로 예약 발행합니다.',
        successStatus: '200',
        pathParams: postIdPathParams,
        requestBody: [
            {
                name: 'published_at',
                type: 'ISO datetime',
                requirement: '선택',
                description: '생략하면 즉시 발행합니다. 미래 시각이면 예약 발행합니다.'
            },
            ...postMutationBodyFields
        ],
        responseBody: postDetailFields,
        errors: [
            '403 auth.insufficient_scope: posts:write 권한이 없습니다.',
            '404 post.not_found: 내 글에서 해당 ID를 찾을 수 없습니다.',
            '409 post.not_draft: 이미 발행되었거나 예약된 글입니다.',
            '422 post.*: 발행 검증에 실패했습니다.'
        ],
        example: {
            title: '임시 글 발행',
            code: `POST /api/developer/v1/posts/25/publish HTTP/1.1
Authorization: Bearer blex_pat_...
Content-Type: application/json

{
  "title": "발행할 제목",
  "content": "# Published"
}`
        }
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

const requirementClassName = (requirement: Requirement) => {
    if (requirement === '필수') return 'border-line bg-surface text-content';
    if (requirement === '조건부') return 'border-line bg-surface text-content-secondary';
    return 'border-line bg-surface text-content-hint';
};

const methodClassName = (method: ApiOperation['method']) => {
    if (method === 'GET') return 'border-line bg-surface text-content';
    if (method === 'POST') return 'border-line bg-surface text-content';
    if (method === 'PATCH') return 'border-line bg-surface text-content';
    return 'border-line bg-surface text-content';
};

const ApiFieldTable = ({ fields, emptyText = '필드 없음' }: { fields?: ApiField[]; emptyText?: string }) => {
    if (!fields || fields.length === 0) {
        return (
            <div className="rounded-lg border border-line bg-surface-elevated px-3 py-2 text-xs text-content-secondary">
                {emptyText}
            </div>
        );
    }

    return (
        <div className="overflow-x-auto rounded-lg border border-line">
            <table className="min-w-full divide-y divide-line text-left text-xs">
                <thead className="bg-surface-elevated text-content-secondary">
                    <tr>
                        <th className="px-3 py-2 font-semibold">필드</th>
                        <th className="px-3 py-2 font-semibold">타입</th>
                        <th className="px-3 py-2 font-semibold">필수</th>
                        <th className="px-3 py-2 font-semibold">설명</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-line bg-surface-subtle">
                    {fields.map((field) => (
                        <tr key={`${field.name}-${field.description}`}>
                            <td className="whitespace-nowrap px-3 py-2 font-mono font-semibold text-content">{field.name}</td>
                            <td className="whitespace-nowrap px-3 py-2 font-mono text-content-secondary">{field.type}</td>
                            <td className="whitespace-nowrap px-3 py-2">
                                <span className={`inline-flex rounded-md border px-2 py-0.5 font-semibold ${requirementClassName(field.requirement)}`}>
                                    {field.requirement}
                                </span>
                            </td>
                            <td className="min-w-[240px] px-3 py-2 leading-relaxed text-content-secondary">{field.description}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
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
                title="API 문서"
                subtitle="요청 필드와 응답 타입은 각 API 상세에서 확인합니다."
                icon={<i className="fas fa-book" />}>
                <div className="space-y-4">
                    <div className="flex flex-col gap-3 rounded-lg border border-line px-4 py-3 sm:flex-row sm:items-center">
                        <div className="text-sm font-semibold text-content">공통 인증</div>
                        <code className="min-w-0 flex-1 break-all font-mono text-xs text-content-secondary">
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

                    <div className="divide-y divide-line rounded-lg border border-line">
                        {apiOperations.map((operation) => (
                            <Link
                                key={operation.id}
                                to="/developer-api/reference/$operationId"
                                params={{ operationId: operation.id }}
                                className="group block p-4 transition-colors duration-150 hover:bg-surface-subtle active:bg-surface-elevated">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className={`inline-flex rounded-md border px-2 py-1 font-mono text-xs font-semibold ${methodClassName(operation.method)}`}>
                                                {operation.method}
                                            </span>
                                            <code className="break-all font-mono text-sm font-semibold text-content">
                                                {operation.path}
                                            </code>
                                        </div>
                                        <p className="mt-2 text-sm font-semibold text-content">{operation.summary}</p>
                                        <p className="mt-1 text-xs leading-relaxed text-content-secondary">{operation.description}</p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 text-xs text-content-secondary lg:justify-end">
                                        <span className="rounded-md border border-line px-2 py-1 font-mono">scope: {operation.scope}</span>
                                        <span className="rounded-md border border-line px-2 py-1 font-mono">{operation.successStatus}</span>
                                        <i className="fas fa-chevron-right text-content-hint transition-transform duration-150 group-hover:translate-x-0.5" />
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </Card>
        </div>
    );
};

export const DeveloperApiReferenceDetail = ({ operationId }: { operationId: string }) => {
    const operation = apiOperations.find((item) => item.id === operationId);

    const handleCopy = async (value: string) => {
        try {
            await navigator.clipboard.writeText(value);
            toast.success('복사되었습니다.');
        } catch {
            toast.error('복사에 실패했습니다.');
        }
    };

    if (!operation) {
        return (
            <div className="space-y-6">
                <SettingsHeader
                    title="API 문서"
                    description="요청한 API 문서를 찾을 수 없습니다."
                    actionPosition="right"
                    action={(
                        <Link to="/developer-api">
                            <Button variant="secondary" size="sm" leftIcon={<i className="fas fa-arrow-left" />}>
                                돌아가기
                            </Button>
                        </Link>
                    )}
                />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <SettingsHeader
                title={operation.summary}
                description={operation.description}
                actionPosition="right"
                action={(
                    <Link to="/developer-api">
                        <Button variant="secondary" size="sm" leftIcon={<i className="fas fa-arrow-left" />}>
                            목록
                        </Button>
                    </Link>
                )}
            />

            <section className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex rounded-md border px-2 py-1 font-mono text-xs font-semibold ${methodClassName(operation.method)}`}>
                        {operation.method}
                    </span>
                    <code className="break-all font-mono text-base font-semibold text-content">
                        {operation.path}
                    </code>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-content-secondary">
                    <span className="rounded-md border border-line px-2 py-1 font-mono">scope: {operation.scope}</span>
                    <span className="rounded-md border border-line px-2 py-1 font-mono">success: {operation.successStatus}</span>
                </div>
            </section>

            <section className="space-y-3 border-t border-line pt-6">
                <div>
                    <h2 className="text-sm font-semibold text-content">인증</h2>
                    <p className="mt-1 text-xs leading-relaxed text-content-secondary">
                        모든 개발자 API 요청은 Bearer 토큰을 Authorization 헤더에 담아 보냅니다.
                    </p>
                </div>
                <div className="flex flex-col gap-3 rounded-lg border border-line px-4 py-3 sm:flex-row sm:items-center">
                    <code className="min-w-0 flex-1 break-all font-mono text-xs text-content-secondary">
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
            </section>

            {operation.pathParams && (
                <section className="space-y-3 border-t border-line pt-6">
                    <h2 className="text-sm font-semibold text-content">Path Parameters</h2>
                    <ApiFieldTable fields={operation.pathParams} />
                </section>
            )}

            {operation.queryParams && (
                <section className="space-y-3 border-t border-line pt-6">
                    <h2 className="text-sm font-semibold text-content">Query Parameters</h2>
                    <ApiFieldTable fields={operation.queryParams} />
                </section>
            )}

            {operation.requestBody && (
                <section className="space-y-3 border-t border-line pt-6">
                    <h2 className="text-sm font-semibold text-content">Request Body</h2>
                    <ApiFieldTable fields={operation.requestBody} />
                </section>
            )}

            <section className="space-y-3 border-t border-line pt-6">
                <h2 className="text-sm font-semibold text-content">Response Body</h2>
                <ApiFieldTable fields={operation.responseBody} />
            </section>

            <section className="space-y-3 border-t border-line pt-6">
                <h2 className="text-sm font-semibold text-content">Errors</h2>
                <div className="divide-y divide-line rounded-lg border border-line">
                    {operation.errors.map((error) => (
                        <code key={error} className="block break-all px-4 py-3 font-mono text-xs text-content-secondary">
                            {error}
                        </code>
                    ))}
                </div>
            </section>

            {operation.example && (
                <section className="space-y-3 border-t border-line pt-6">
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="text-sm font-semibold text-content">{operation.example.title}</h2>
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => handleCopy(operation.example?.code || '')}
                            leftIcon={<i className="fas fa-copy" />}>
                            복사
                        </Button>
                    </div>
                    <pre className="overflow-x-auto rounded-lg border border-line p-4 text-xs leading-relaxed text-content-secondary"><code>{operation.example.code}</code></pre>
                </section>
            )}
        </div>
    );
};

export default DeveloperApiSetting;
