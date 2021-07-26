import axios, {
    objectToForm,
    ResponseData,
} from './index';

export async function postImage(file: File) {
    return await axios.request<ResponseData<PostImageData>>({
        url: `/v1/image`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: objectToForm({
            image: file
        }),
    });
}

export interface PostImageData {
    url: string;
}