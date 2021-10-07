import { snackBar } from '@modules/snack-bar';

import * as API from '@modules/api';
import { CONFIG } from '@modules/settings';

import { loadingContext } from '@state/loading';

export function getImage(path: string) {
    return `https://${CONFIG.STATIC_SERVER}/${path}`;
}

interface GetPostsImageOptions {
    preview?: boolean;
    minify?: boolean;
}

export function getPostsImage(path: string, options?: GetPostsImageOptions) {
    if (path !== '') {
        const [ ext ] = path.split('.').slice(-1);
        if (options?.preview) {
            return getImage(path) + '.preview.jpg';
        }
        if (options?.minify) {
            return getImage(path) + '.minify.' + ext;
        }
        return getImage(path);
    }
    return getImage('assets/images/default-post.png');
}

export function getUserImage(path: string) {
    if (path !== '') {
        return getImage(path);
    }
    return getImage('assets/images/default-avatar.jpg');
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
        snackBar('🤔 하나씩 업로드 할 수 있습니다.');
        return;
    }
    const [ file ] = files;
    return uploadImage(file);
}

export async function uploadImage(file: File) {
    if (!isImage(file)) {
        snackBar('🤔 이미지 파일이 아닙니다.');
        return;
    }
    try {
        loadingContext.setState({ isLoading: true });
        const { data } = await API.postImage(file);
        loadingContext.setState({ isLoading: false });
        if (data.status === 'ERROR') {
            snackBar(API.EMOJI.AFTER_REQ_ERR + data.errorMessage);
            return;
        }
        return data.body.url;
    } catch(error: any) {
        loadingContext.setState({ isLoading: false });
        const { status } = error.response;
        if (status == 404) {
            snackBar('🤔 로그인이 필요합니다.');
            return;
        }
        if (status > 500) {
            snackBar('🤔 이미지 파일이 아닙니다.');
            return;
        }
    }
}