import axios from 'axios';

axios.defaults.withCredentials = true;

import Config from '../config.json';

import {
    ResponseData,
    objectToForm,
} from './index';

export async function postImage(file: File) {
    return await axios.request<ResponseData<PostImageData>>({
        url: `${Config.API_SERVER}/v1/image`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: objectToForm({
            image: file
        }),
        withCredentials: true,
    });
}

export interface PostImageData {
    url: string;
}