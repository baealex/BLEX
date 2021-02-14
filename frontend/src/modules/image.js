import { toast } from 'react-toastify';

import * as API from './api';

export function isImage(file) {
    const validTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif'
    ];
    if (validTypes.indexOf(file.type) === -1) {
        return false;
    }
    return true;
}

export async function dropImage(e) {
    e.stopPropagation();
    e.preventDefault();
    const { files } = e.dataTransfer;
    if (files.length > 1) {
        toast('🤔 하나씩 업로드 할 수 있습니다.');
        return;
    }
    const [ file ] = files;
    return uploadImage(file);
}

export async function uploadImage(file) {
    if (!isImage(file)) {
        toast('🤔 이미지 파일이 아닙니다.');
        return;
    }
    try {
        const { data } = await API.uploadImage(file);
        return data;
    } catch(error) {
        const { status } = error.response;
        if(status == 404) {
            return '로그인이 필요합니다';
        }
        if(status > 500) {
            return '서버 장애가 발생했습니다';
        }
    }
}