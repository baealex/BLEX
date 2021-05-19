import { toast } from 'react-toastify';

import NProgress from 'nprogress';

import * as API from './api';

import Config from '@modules/config.json';

export function getImage(path: string) {
    return `https://${Config.STATIC_SERVER}/${path}`;
}

export function getPostsImage(path: string) {
    if (path !== '') {
        return getImage(path);
    }
    return getImage('assets/images/default-post.png');
}

export function getUserImage(path: string) {
    if (path !== '') {
        return getImage(path);
    }
    return getImage('assets/images/default-avatar.png');
}

export function isImage(file: File) {
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

export async function dropImage(e: any) {
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

export async function uploadImage(file: File) {
    if (!isImage(file)) {
        toast('🤔 이미지 파일이 아닙니다.');
        return;
    }
    try {
        NProgress.start();
        const { data } = await API.postImage(file);
        NProgress.done();
        if (data.status === 'ERROR') {
            toast(API.EMOJI.AFTER_REQ_ERR + data.errorMessage);
            return;
        }
        return data.body.url;
    } catch(error) {
        NProgress.done();
        const { status } = error.response;
        if(status == 404) {
            toast('🤔 로그인이 필요합니다.');
            return;
        }
        if(status > 500) {
            toast('🤔 이미지 파일이 아닙니다.');
            return;
        }
    }
}