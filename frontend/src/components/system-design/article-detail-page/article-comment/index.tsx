import classNames from 'classnames/bind';
import styles from './Comment.module.scss';
const cn = classNames.bind(styles);

import {
    useEffect,
    useState
} from 'react';

import { Alert } from '@design-system';
import { CommentCard } from './comment-card';
import { CommentEditor } from './comment-editor';
import { CommentForm } from './comment-form';

import * as API from '@modules/api';
import {
    lazyIntersection,
    lazyLoadResource
} from '@modules/optimize/lazy';
import blexer from '@modules/utility/blexer';
import { snackBar } from '@modules/ui/snack-bar';

import { authStore } from '@stores/auth';
import { modalStore } from '@stores/modal';

export interface ArticleCommentProps {
    author: string;
    url: string;
    totalComment: number;
}

interface CommentsStateItem extends API.GetPostCommentDataComment {
    isEdit: boolean;
    textMarkdown: string
}

export function ArticleComment(props: ArticleCommentProps) {
    const [ isLogin, setIsLogin ] = useState(authStore.state.isLogin);
    const [ username, setUsername ] = useState(authStore.state.username);
    const [ comments, setComments ] = useState<CommentsStateItem[]>([]);
    const [ commentText, setCommentText ] = useState('');

    const handleSubmit = async (content: string) => {
        const { data } = await API.postComments(props.url, content);
        if (data.status !== 'DONE') {
            snackBar('😅 댓글 작성중 오류가 발생했습니다!');
            return;
        }
        setComments(comments.concat({
            isEdit: false,
            textMarkdown: '',
            ...data.body
        }));
        lazyLoadResource();
    };

    const handleEdit = async (pk: number) => {
        const { data } = await API.getComment(pk);
        setComments(comments.map(comment => (
            comment.pk === pk ? ({
                ...comment,
                isEdit: true,
                textMarkdown: data.body.textMd
            }) : comment
        )));
    };

    const handleLike = async (pk: number) => {
        const { data } = await API.putCommentLike(pk);
        if (data.status === 'ERROR') {
            switch (data.errorCode) {
            case API.ERROR.NOT_LOGIN:
                snackBar('😅 로그인이 필요합니다.', {
                    onClick:() => {
                        modalStore.onOpenModal('isLoginModalOpen');
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
        setComments(comments.map(comment => (
            comment.pk === pk ? ({
                ...comment,
                isLiked: !comment.isLiked,
                totalLikes: data.body.totalLikes
            }) : comment
        )));
    };

    const handleDelte = async (pk: number) => {
        if (confirm('😮 정말 이 댓글을 삭제할까요?')) {
            const { data } = await API.deleteComment(pk);
            if (data.status === 'DONE') {
                setComments(comments.map(comment => (
                    comment.pk === pk ? ({
                        ...comment,
                        ...data.body
                    }) : comment
                )));
                snackBar('😀 댓글이 삭제되었습니다.');
            }
        }
    };

    const handleTag = async (tagUsername: string) => {
        if (!username) {
            snackBar('😅 로그인이 필요합니다.', { onClick: () => modalStore.onOpenModal('isLoginModalOpen') });
            return;
        }

        if (commentText.includes(`\`@${tagUsername}\``)) {
            snackBar(`😅 이미 ${tagUsername}님을 태그했습니다.`);
            return;
        }

        setCommentText(commentText + ` \`@${tagUsername}\``);
        snackBar(`😀 ${tagUsername}님을 태그했습니다.`);
    };

    const handleEditSubmit = async (pk: number, content: string) => {
        const { data } = await API.putComment(pk, content);
        if (data.status === 'DONE') {
            setComments(comments.map(comment => (
                comment.pk === pk ? ({
                    ...comment,
                    isEdit: false,
                    isEdited: true,
                    textHtml: blexer(content)
                }) : comment
            )));
            snackBar('😀 댓글이 수정되었습니다.');
            lazyLoadResource();
        }
    };

    const handleEditCancle = async (pk: number) => {
        setComments(comments.map(comment => (
            comment.pk == pk ? ({
                ...comment,
                isEdit: false
            }) : comment
        )));
    };

    useEffect(() => {
        const updateKey = authStore.subscribe((state) => {
            setIsLogin(state.isLogin);
            setUsername(state.username);
        });

        if (props.totalComment > 0) {
            const observer = lazyIntersection('.comments', () => {
                API.getPostComments(props.url).then((response) => {
                    setComments(response.data.body.comments.map(comment => ({
                        ...comment,
                        isEdit: false,
                        textMarkdown: ''
                    })));
                    lazyLoadResource();
                });
            });

            return () => {
                observer?.disconnect();
                authStore.unsubscribe('Comment');
            };
        } else {
            if (comments.length > 0) {
                setComments([]);
            }
        }

        return () => {
            authStore.unsubscribe(updateKey);
        };
    }, [props.url, username]);

    return (
        <div className={`comments ${cn('background')} py-5`}>
            <div className="container">
                <div className="col-lg-8 mx-auto px-0">
                    {comments && comments.length > 0 ? comments.map((comment, idx: number) => (
                        comment.isEdit ? (
                            <CommentEditor
                                key={comment.pk}
                                pk={comment.pk}
                                content={comment.textMarkdown}
                                onSubmit={handleEditSubmit}
                                onCancle={handleEditCancle}
                            />
                        ) : (
                            <CommentCard
                                key={idx}
                                pk={comment.pk}
                                author={comment.author}
                                authorImage={comment.authorImage}
                                timeSince={comment.timeSince}
                                html={comment.textHtml}
                                isEdited={comment.isEdited}
                                isOwner={username === comment.author}
                                totalLikes={comment.totalLikes}
                                isLiked={comment.isLiked}
                                onEdit={handleEdit}
                                onDelete={handleDelte}
                                onLike={comment.author !== 'Ghost' ? handleLike : undefined}
                                onTag={comment.author !== 'Ghost' ? handleTag : undefined}
                            />
                        )
                    )) : (
                        <CommentCard
                            pk={-1}
                            author="Ghost"
                            authorImage="https://static.blex.me/assets//images/ghost.png"
                            timeSince="0 minutes"
                            html="작성된 댓글이 없습니다. 첫 댓글을 달아보세요!"
                            isEdited={false}
                            isOwner={false}
                            totalLikes={0}
                            isLiked={false}
                            onEdit={() => 0}
                            onDelete={() => 0}
                        />
                    )}
                    {isLogin ? (
                        <CommentForm
                            content={commentText}
                            onChange={setCommentText}
                            onSubmit={handleSubmit}
                        />
                    ) : (
                        <Alert
                            type="warning"
                            onClick={() => modalStore.onOpenModal('isLoginModalOpen')}>
                            댓글을 작성하려면 로그인이 필요합니다.
                        </Alert>
                    )}
                </div>
            </div>
        </div>
    );
}