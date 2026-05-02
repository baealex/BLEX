import { paginationField } from './fields';
import type { ApiOperation } from './types';

export const publishingOperations: ApiOperation[] = [
    {
        id: 'search-posts',
        method: 'GET',
        path: '/api/developer/v1/posts/search',
        summary: '내 글 검색',
        scope: 'posts:read',
        description: 'AI 에이전트가 기존 발행물과 임시 글을 찾을 수 있도록 제목, URL, 설명, 태그, 본문을 검색합니다.',
        successStatus: '200',
        queryParams: [
            {
                name: 'q',
                type: 'string',
                requirement: '선택',
                description: '검색어입니다. 제목, URL, 설명, 태그, 원문/렌더링 본문을 대상으로 검색합니다.'
            },
            {
                name: 'tag',
                type: 'string',
                requirement: '선택',
                description: '태그 이름입니다. 여러 tag 파라미터 또는 쉼표 구분 값을 사용할 수 있습니다.'
            },
            {
                name: 'status',
                type: 'draft | published | scheduled | hidden',
                requirement: '선택',
                description: '상태별로 필터링합니다.'
            },
            {
                name: 'series_id',
                type: 'number',
                requirement: '선택',
                description: '시리즈 ID로 필터링합니다.'
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
                description: '검색된 글 요약 목록입니다.'
            },
            paginationField
        ],
        errors: [
            '403 auth.insufficient_scope: posts:read 권한이 없습니다.',
            '400 request.invalid_series_id: series_id가 숫자가 아닙니다.',
            '400 post.invalid_status: 지원하지 않는 status입니다.'
        ],
        example: {
            title: '태그와 본문 검색',
            code: `GET /api/developer/v1/posts/search?q=publishing&tag=mcp&status=draft HTTP/1.1
Authorization: Bearer blex_pat_...`
        }
    },
    {
        id: 'list-tags',
        method: 'GET',
        path: '/api/developer/v1/tags',
        summary: '내 글 태그 목록',
        scope: 'posts:read',
        description: '토큰 소유자의 글에 연결된 태그와 각 태그의 글 수를 조회합니다.',
        successStatus: '200',
        responseBody: [
            {
                name: 'tags',
                type: '{ name, post_count }[]',
                requirement: '필수',
                description: '태그 이름과 연결된 내 글 수입니다.'
            }
        ],
        errors: [
            '403 auth.insufficient_scope: posts:read 권한이 없습니다.'
        ],
        example: {
            title: '태그 목록 조회',
            code: `GET /api/developer/v1/tags HTTP/1.1
Authorization: Bearer blex_pat_...`
        }
    },
    {
        id: 'list-series',
        method: 'GET',
        path: '/api/developer/v1/series',
        summary: '내 시리즈 목록',
        scope: 'posts:read',
        description: '토큰 소유자의 시리즈와 연결된 글 수를 조회합니다.',
        successStatus: '200',
        responseBody: [
            {
                name: 'series',
                type: '{ id, name, url, description, is_hidden, post_count, created_at, updated_at }[]',
                requirement: '필수',
                description: '내 시리즈 목록입니다.'
            }
        ],
        errors: [
            '403 auth.insufficient_scope: posts:read 권한이 없습니다.'
        ],
        example: {
            title: '시리즈 목록 조회',
            code: `GET /api/developer/v1/series HTTP/1.1
Authorization: Bearer blex_pat_...`
        }
    }
];
