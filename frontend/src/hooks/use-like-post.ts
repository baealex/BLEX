import * as API from '~/modules/api';
import { snackBar } from '~/modules/ui/snack-bar';

import { modalStore } from '~/stores/modal';

interface Post {
    url: string;
    author: string;
    hasLiked: boolean;
    countLikes: number;
}

interface Options<T> {
    onLike: (post: T, countLikes: number) => void;
    onError?: (error?: string) => void;
}

export const useLikePost = <T extends Post>({
    onLike,
    onError
}: Options<T>) => {
    return async (post: T) => {
        const { data } = await API.putAnUserPosts('@' + post.author, post.url, 'like');
        if (data.status === 'DONE') {
            if (typeof data.body.countLikes === 'number') {
                onLike(post, data.body.countLikes);
            }
        }
        if (data.status === 'ERROR') {
            if (data.errorCode === API.ERROR.NEED_LOGIN) {
                snackBar('😅 로그인이 필요합니다.', {
                    onClick: () => {
                        modalStore.open('isOpenAuthGetModal');
                    }
                });
            }
            onError?.(data.errorMessage);
        }
    };
};