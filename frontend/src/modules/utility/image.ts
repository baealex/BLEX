import { getHash } from '~/modules/utility/hash';
import { message } from '~/modules/utility/message';
import { snackBar } from '~/modules/ui/snack-bar';

import * as API from '~/modules/api';
import { CONFIG } from '~/modules/settings';

import { loadingStore } from '~/stores/loading';

export function getImage(path: string) {
    return `${CONFIG.STATIC_SERVER}/${path}`;
}

interface GetPostsImageOptions {
    preview?: boolean;
    minify?: boolean;
    title?: string;
}

const DEFAULT_COVER_LIST = [
    'assets/images/default-cover-1.jpg',
    'assets/images/default-cover-2.jpg',
    'assets/images/default-cover-3.jpg',
    'assets/images/default-cover-4.jpg',
    'assets/images/default-cover-5.jpg',
    'assets/images/default-cover-6.jpg'
];

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
    if (options?.title) {
        const hash = getHash(options.title);
        const index = hash % DEFAULT_COVER_LIST.length;
        return getImage(DEFAULT_COVER_LIST[index]);
    }
    return DEFAULT_COVER_LIST[0];
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
        snackBar(message('BEFORE_REQ_ERR', '하나씩 업로드 할 수 있습니다.'));
        return;
    }
    const [ file ] = files;
    return uploadImage(file);
}

export async function uploadImage(file: File) {
    if (!isImage(file)) {
        snackBar(message('BEFORE_REQ_ERR', '이미지 파일이 아닙니다.'));
        return;
    }
    try {
        loadingStore.start();
        const { data } = await API.postImage(file);
        loadingStore.end();
        if (data.status === 'ERROR') {
            snackBar(message('AFTER_REQ_ERR', data.errorMessage));
            return;
        }
        return data.body.url;
    } catch (error: any) {
        loadingStore.end();
        const { status } = error.response;
        if (status == 404) {
            snackBar(message('AFTER_REQ_ERR', '로그인이 필요합니다.'));
            return;
        }
        if (status > 500) {
            snackBar(message('AFTER_REQ_ERR', '이미지 파일이 아닙니다.'));
            return;
        }
    }
}
