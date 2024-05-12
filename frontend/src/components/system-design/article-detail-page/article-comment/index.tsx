import classNames from 'classnames/bind';
import styles from './Comment.module.scss';
const cn = classNames.bind(styles);

import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from 'badland-react';

import { Alert, Container, Flex, Loading } from '~/components/design-system';
import { CommentCard } from './comment-card';
import { CommentEditor } from './comment-editor';
import { CommentForm } from './comment-form';

import * as API from '~/modules/api';
import { CONFIG } from '~/modules/settings';
import blexer from '~/modules/utility/blexer';
import { lazyLoadResource } from '~/modules/optimize/lazy';
import { snackBar } from '~/modules/ui/snack-bar';

import { authStore } from '~/stores/auth';
import { modalStore } from '~/stores/modal';
import { useFetch } from '~/hooks/use-fetch';

export interface ArticleCommentProps {
    author: string;
    url: string;
    countComments: number;
}

export function ArticleComment(props: ArticleCommentProps) {
    const ref = useRef<HTMLDivElement>(null);

    const [{ isLogin, username }] = useStore(authStore);
    const [commentText, setCommentText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { data: comments = [], mutate: setComments } = useFetch(['posts', 'comments', props.url], async () => {
        if (props.countComments > 0) {
            const { data } = await API.getPostComments(props.url);
            return data.body.comments.map(comment => ({
                ...comment,
                isEdit: false,
                textMarkdown: ''
            }));
        }
    }, { observeRef: ref });

    const handleSubmit = useCallback(async (content: string) => {
        if (isSubmitting) {
            return;
        }
        setIsSubmitting(true);
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
        setCommentText('');
        setIsSubmitting(false);
    }, [props.url]);

    const handleClickEdit = useCallback(async (id: number) => {
        const { data } = await API.getComment(id);
        setComments(prevComments => prevComments?.map(comment => (
            comment.id === id ? ({
                ...comment,
                isEdit: true,
                textMarkdown: data.body.textMd
            }) : comment
        )));
    }, []);

    const handleClickLike = useCallback(async (id: number) => {
        const { data } = await API.putCommentLike(id);
        if (data.status === 'ERROR') {
            switch (data.errorCode) {
                case API.ERROR.NEED_LOGIN:
                    snackBar('😅 로그인이 필요합니다.', {
                        onClick: () => {
                            modalStore.open('isOpenAuthGetModal');
                        }
                    });
                    return;
                case API.ERROR.AUTHENTICATION:
                    snackBar('😅 자신의 댓글은 추천할 수 없습니다.');
                    return;
                case API.ERROR.REJECT:
                    snackBar('😅 삭제된 댓글은 추천할 수 없습니다.');
                    return;
            }
        }
        setComments(prevComments => prevComments?.map(comment => (
            comment.id === id ? ({
                ...comment,
                isLiked: !comment.isLiked,
                countLikes: data.body.countLikes
            }) : comment
        )));
    }, []);

    const handleClickDelete = useCallback(async (id: number) => {
        if (confirm('😮 정말 이 댓글을 삭제할까요?')) {
            if (isSubmitting) {
                return;
            }
            setIsSubmitting(true);
            const { data } = await API.deleteComment(id);
            if (data.status === 'DONE') {
                setComments(prevComments => prevComments?.map(comment => (
                    comment.id === id ? ({
                        ...comment,
                        ...data.body
                    }) : comment
                )));
                snackBar('😀 댓글이 삭제되었습니다.');
            }
            setIsSubmitting(false);
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

    const handleEditSubmit = useCallback(async (id: number, content: string) => {
        if (isSubmitting) {
            return;
        }
        setIsSubmitting(true);
        const { data } = await API.putComment(id, content);
        if (data.status !== 'DONE') {
            snackBar('😅 댓글 수정중 오류가 발생했습니다!');
            return;
        }
        setComments(prevComments => prevComments?.map(comment => (
            comment.id === id ? ({
                ...comment,
                isEdit: false,
                isEdited: true,
                renderedContent: blexer(content)
            }) : comment
        )));
        setIsSubmitting(false);
    }, []);

    const handleEditCancel = useCallback(async (id: number) => {
        setComments(prevComments => prevComments?.map(comment => (
            comment.id == id ? ({
                ...comment,
                isEdit: false
            }) : comment
        )));
    }, []);

    useEffect(() => {
        lazyLoadResource();
    }, [comments]);

    return (
        <div ref={ref} id="comments" className={`comments ${cn('background')} py-5`}>
            <Container size="sm">
                {comments?.length > 0 ? comments.map((comment) => (
                    comment.isEdit ? (
                        <CommentEditor
                            key={comment.id}
                            id={comment.id}
                            content={comment.textMarkdown}
                            onSubmit={handleEditSubmit}
                            onCancel={handleEditCancel}
                        />
                    ) : (
                        <CommentCard
                            key={comment.id}
                            {...comment}
                            isOwner={username === comment.author}
                            onClickEdit={handleClickEdit}
                            onClickDelete={handleClickDelete}
                            onClickLike={comment.author !== 'Ghost' ? handleClickLike : undefined}
                            onClickUserTag={comment.author !== 'Ghost' ? handleClickUserTag : undefined}
                        />
                    )
                )) : (
                    <CommentCard
                        id={-1}
                        author="Ghost"
                        authorImage={`${CONFIG.STATIC_SERVER}/assets/images/ghost.jpg`}
                        createdDate="0분 전"
                        renderedContent="작성된 댓글이 없습니다. 첫 댓글을 달아보세요!"
                        isEdited={false}
                        countLikes={0}
                        isLiked={false}
                    />
                )}
                {isSubmitting && (
                    <Flex justify="center" className="my-5">
                        <Loading position="inline" />
                    </Flex>
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
            </Container>
        </div>
    );
}
