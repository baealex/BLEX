import { toast } from 'react-toastify';

import API from './api';

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
    if (!isImage(file)) {
        toast('🤔 이미지 파일이 아닙니다.');
        return;
    }
    const { data } = await API.uploadImage(file);
    return data;
}