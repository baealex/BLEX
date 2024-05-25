import request, { objectToForm } from './request';

export interface PostImageResponseData {
    url: string;
}

export async function postImage(file: File) {
    return await request<PostImageResponseData>({
        url: '/v1/image',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: objectToForm({
            image: file
        })
    });
}
