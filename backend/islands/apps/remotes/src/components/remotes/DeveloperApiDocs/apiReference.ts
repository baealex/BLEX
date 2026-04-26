export type Requirement = '필수' | '선택' | '조건부';

export interface ApiField {
    name: string;
    type: string;
    requirement: Requirement;
    description: string;
}

export interface ApiExample {
    title: string;
    code: string;
}

export interface ApiOperation {
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

export const apiOperations: ApiOperation[] = [
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

export const methodClassName = (method: ApiOperation['method']) => {
    if (method === 'GET') return 'border-line bg-surface text-content';
    if (method === 'POST') return 'border-line bg-surface text-content';
    if (method === 'PATCH') return 'border-line bg-surface text-content';
    return 'border-line bg-surface text-content';
};
