import {
    paginationField,
    postDetailFields,
    postIdPathParams,
    postMutationBodyFields
} from './fields';
import type { ApiOperation } from './types';

export const postOperations: ApiOperation[] = [
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
            paginationField
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
