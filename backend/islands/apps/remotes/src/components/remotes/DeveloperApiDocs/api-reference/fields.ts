import type { ApiField } from './types';

export const postSummaryFields: ApiField[] = [
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

export const postDetailFields: ApiField[] = [
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

export const paginationField: ApiField = {
    name: 'pagination',
    type: '{ page, limit, total }',
    requirement: '필수',
    description: '현재 페이지와 전체 개수입니다.'
};

export const postIdPathParams: ApiField[] = [
    {
        name: 'id',
        type: 'number',
        requirement: '필수',
        description: '대상 글 ID입니다.'
    }
];

export const postMutationBodyFields: ApiField[] = [
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
