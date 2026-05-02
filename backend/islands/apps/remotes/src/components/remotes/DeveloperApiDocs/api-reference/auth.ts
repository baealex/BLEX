import type { ApiOperation } from './types';

export const authOperations: ApiOperation[] = [
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
    }
];
