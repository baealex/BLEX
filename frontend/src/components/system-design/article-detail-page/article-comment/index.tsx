import classNames from 'classnames/bind';
import styles from './Comment.module.scss';
const cn = classNames.bind(styles);

import { useCallback, useRef, useState } from 'react';
import { useStore } from 'badland-react';

import { Alert } from '@design-system';
import { CommentCard } from './comment-card';
import { CommentEditor } from './comment-editor';
import { CommentForm } from './comment-form';

import * as API from '~/modules/api';
import blexer from '~/modules/utility/blexer';
import { lazyLoadResource } from '~/modules/optimize/lazy';
import { snackBar } from '~/modules/ui/snack-bar';

import { authStore } from '~/stores/auth';
import { modalStore } from '~/stores/modal';
import { useFetch } from '~/hooks/use-fetch';

export interface ArticleCommentProps {
    author: string;
    url: string;
    totalComment: number;
}

export function ArticleComment(props: ArticleCommentProps) {
    const ref = useRef<HTMLDivElement>(null);

    const [{ isLogin, username }] = useStore(authStore);
    const [ commentText, setCommentText ] = useState('');

    const { data: comments = [], mutate: setComments } = useFetch(['posts', 'comments', props.url], async () => {
        if (props.totalComment > 0) {
            const { data } = await API.getPostComments(props.url);
            return data.body.comments.map(comment => ({
                ...comment,
                isEdit: false,
                textMarkdown: ''
            }));
        }
    }, { observeRef: ref });

    const handleSubmit = useCallback(async (content: string) => {
        const { data } = await API.postComments(props.url, content);
        if (data.status !== 'DONE') {
            snackBar('😅 댓글 작성중 오류가 발생했습니다!');
            return;
        }
        setComments(prevComments => (prevComments || []).concat({
            isEdit: false,
            textMarkdown: '',
            ...data.body
        }));
        setTimeout(lazyLoadResource, 300);
    }, []);

    const handleClickEdit = useCallback(async (pk: number) => {
        const { data } = await API.getComment(pk);
        setComments(prevComments => prevComments?.map(comment => (
            comment.pk === pk ? ({
                ...comment,
                isEdit: true,
                textMarkdown: data.body.textMd
            }) : comment
        )));
    }, []);

    const handleClickLike = useCallback(async (pk: number) => {
        const { data } = await API.putCommentLike(pk);
        if (data.status === 'ERROR') {
            switch (data.errorCode) {
                case API.ERROR.NOT_LOGIN:
                    snackBar('😅 로그인이 필요합니다.', {
                        onClick:() => {
                            modalStore.open('isOpenAuthGetModal');
                        }
                    });
                    return;
                case API.ERROR.SAME_USER:
                    snackBar('😅 자신의 댓글은 추천할 수 없습니다.');
                    return;
                case API.ERROR.REJECT:
                    snackBar('😅 삭제된 댓글은 추천할 수 없습니다.');
                    return;
            }
        }
        setComments(prevComments => prevComments?.map(comment => (
            comment.pk === pk ? ({
                ...comment,
                isLiked: !comment.isLiked,
                totalLikes: data.body.totalLikes
            }) : comment
        )));
    }, []);

    const handleClickDelete = useCallback(async (pk: number) => {
        if (confirm('😮 정말 이 댓글을 삭제할까요?')) {
            const { data } = await API.deleteComment(pk);
            if (data.status === 'DONE') {
                setComments(prevComments => prevComments?.map(comment => (
                    comment.pk === pk ? ({
                        ...comment,
                        ...data.body
                    }) : comment
                )));
                snackBar('😀 댓글이 삭제되었습니다.');
            }
        }
    }, []);

    const handleClickUserTag = useCallback(async (tagUsername: string) => {
        if (!username) {
            snackBar('😅 로그인이 필요합니다.', {
                onClick: () => modalStore.open('isOpenAuthGetModal')
            });
            return;
        }

        if (commentText.includes(`\`@${tagUsername}\``)) {
            snackBar(`😅 이미 ${tagUsername}님을 태그했습니다.`);
            return;
        }

        setCommentText(prevCommentText => prevCommentText + ` \`@${tagUsername}\``);
        snackBar(`😀 ${tagUsername}님을 태그했습니다.`);
    }, [username, commentText]);

    const handleEditSubmit = useCallback(async (pk: number, content: string) => {
        const { data } = await API.putComment(pk, content);
        if (data.status !== 'DONE') {
            snackBar('😅 댓글 수정중 오류가 발생했습니다!');
            return;
        }
        setComments(prevComments => prevComments?.map(comment => (
            comment.pk === pk ? ({
                ...comment,
                isEdit: false,
                isEdited: true,
                textHtml: blexer(content)
            }) : comment
        )));
        snackBar('😀 댓글이 수정되었습니다.');
        setTimeout(lazyLoadResource, 300);
    }, []);

    const handleEditCancel = useCallback(async (pk: number) => {
        setComments(prevComments => prevComments?.map(comment => (
            comment.pk == pk ? ({
                ...comment,
                isEdit: false
            }) : comment
        )));
        setTimeout(lazyLoadResource, 300);
    }, []);

    return (
        <div ref={ref} className={`comments ${cn('background')} py-5`}>
            <div className="x-container">
                {comments?.length > 0 ? comments.map((comment) => (
                    comment.isEdit ? (
                        <CommentEditor
                            key={comment.pk}
                            pk={comment.pk}
                            content={comment.textMarkdown}
                            onSubmit={handleEditSubmit}
                            onCancel={handleEditCancel}
                        />
                    ) : (
                        <CommentCard
                            key={comment.pk}
                            pk={comment.pk}
                            author={comment.author}
                            authorImage={comment.authorImage}
                            createdDate={comment.createdDate}
                            html={comment.textHtml}
                            isEdited={comment.isEdited}
                            isOwner={username === comment.author}
                            totalLikes={comment.totalLikes}
                            isLiked={comment.isLiked}
                            onClickEdit={handleClickEdit}
                            onClickDelete={handleClickDelete}
                            onClickLike={comment.author !== 'Ghost' ? handleClickLike : undefined}
                            onClickUserTag={comment.author !== 'Ghost' ? handleClickUserTag : undefined}
                        />
                    )
                )) : (
                    <CommentCard
                        pk={-1}
                        author="Ghost"
                        authorImage="https://static.blex.me/assets/images/ghost.jpg"
                        createdDate="0분 전"
                        html="작성된 댓글이 없습니다. 첫 댓글을 달아보세요!"
                        isEdited={false}
                        totalLikes={0}
                        isLiked={false}
                    />
                )}
                {isLogin ? (
                    <CommentForm
                        author={props.author}
                        url={props.url}
                        content={commentText}
                        onChange={setCommentText}
                        onSubmit={handleSubmit}
                    />
                ) : (
                    <Alert
                        type="warning"
                        onClick={() => modalStore.open('isOpenAuthGetModal')}>
                        댓글을 작성하려면 로그인이 필요합니다.
                    </Alert>
                )}
            </div>
        </div>
    );
}
