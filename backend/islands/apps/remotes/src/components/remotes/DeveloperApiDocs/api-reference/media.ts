import type { ApiOperation } from './types';

export const mediaOperations: ApiOperation[] = [
    {
        id: 'upload-image',
        method: 'POST',
        path: '/api/developer/v1/images',
        summary: '본문 이미지 업로드',
        scope: 'posts:write',
        description: 'AI 에이전트가 생성하거나 로컬에 저장한 이미지를 업로드하고, 글 본문에 삽입할 수 있는 URL을 받습니다.',
        successStatus: '201',
        requestBody: [
            {
                name: 'image',
                type: 'multipart file',
                requirement: '필수',
                description: 'jpg, jpeg, png, gif, mp4, webm 파일입니다.'
            }
        ],
        responseBody: [
            {
                name: 'url',
                type: 'string',
                requirement: '필수',
                description: '업로드된 이미지 또는 영상의 미디어 URL입니다.'
            }
        ],
        errors: [
            '403 auth.insufficient_scope: posts:write 권한이 없습니다.',
            '400 image.missing: 이미지 파일이 없습니다.',
            '400 image.invalid_extension: 허용되지 않은 확장자입니다.',
            '422 image.upload_failed: 이미지 처리에 실패했습니다.'
        ],
        example: {
            title: '이미지 업로드',
            code: `POST /api/developer/v1/images HTTP/1.1
Authorization: Bearer blex_pat_...
Content-Type: multipart/form-data

image=@cover.png`
        }
    }
];
