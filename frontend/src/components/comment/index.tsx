import styles from './Comment.module.scss';
import classNames from 'classnames/bind';
const cn = classNames.bind(styles);

import {
    useState,
    useEffect,
} from 'react';

import { CommentCard } from './comment-card';
import { CommentEditor } from './comment-editor';
import { CommentForm } from './comment-form';

import { toast } from 'react-toastify';

import * as API from '@modules/api';
import Global from '@modules/global';
import blexer from '@modules/blexer';
import {
    lazyLoadResource,
    lazyIntersection
} from '@modules/lazy';
import { Alert } from '@components/atoms';

export interface CommentProps {
    author: string;
    url: string;
    totalComment: number;
}

interface Comment extends API.GetPostCommentDataComment {
    isEdit: boolean;
    textMarkdown: string
}

export function Comment(props: CommentProps) {
    const [ isLogin, setIsLogin ] = useState(Global.state.isLogin);
    const [ username, setUsername ] = useState(Global.state.username);
    const [ comments, setComments ] = useState<Comment[]>([]);
    const [ commentText, setCommentText ] = useState('');

    const handleSubmit = async (content: string) => {
        const html = blexer(content);
        const { data } = await API.postComments(props.url, content, html);
        if(data.status !== 'DONE') {
            toast('😅 댓글 작성중 오류가 발생했습니다!');
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
    }

    const handleLike = async (pk: number) => {
        const { data } = await API.putCommentLike(pk);
        if (data.status === 'ERROR') {
            switch (data.errorCode) {
                case API.ERROR.NOT_LOGIN:
                    toast('😅 로그인이 필요합니다.', {
                        onClick:() => {
                            Global.onOpenModal('isLoginModalOpen');
                        }
                    });
                    return;
                case API.ERROR.SAME_USER:
                    toast('😅 자신의 댓글은 추천할 수 없습니다.');
                    return;
                case API.ERROR.REJECT:
                    toast('😅 삭제된 댓글은 추천할 수 없습니다.');
                    return;
            }
        }
        setComments(comments.map(comment => (
            comment.pk === pk ? ({
                ...comment,
                isLiked: !comment.isLiked,
                totalLikes: data.body.totalLikes,
            }) : comment
        )));
    }

    const handleDelte = async (pk: number) => {
        if(confirm('😮 정말 이 댓글을 삭제할까요?')) {
            const { data } = await API.deleteComment(pk);
            if(data.status === 'DONE') {
                setComments(comments.map(comment => (
                    comment.pk === pk ? ({
                        ...comment,
                        ...data.body
                    }) : comment
                )));
                toast('😀 댓글이 삭제되었습니다.');
            }
        }
    }

    const handleTag = async (tagUsername: string) => {
        if(!username) {
            toast('😅 로그인이 필요합니다.', {
                onClick: () => Global.onOpenModal('isLoginModalOpen')
            });
            return;
        }

        if(commentText.includes(`\`@${tagUsername}\``)) {
            toast(`😅 이미 ${tagUsername}님을 태그했습니다.`);
            return; 
        }

        setCommentText(commentText + ` \`@${tagUsername}\``);
        toast(`😀 ${tagUsername}님을 태그했습니다.`);
    }

    const handleEditSubmit = async (pk: number, content: string) => {
        const html = blexer(content);
        const { data } = await API.putComment(pk, content, html);
        if(data.status === 'DONE') {
            setComments(comments.map(comment => (
                comment.pk === pk ? ({
                    ...comment,
                    isEdit: false,
                    textHtml: html,
                    isEdited: true
                }) : comment
            )));
            toast('😀 댓글이 수정되었습니다.');
            lazyLoadResource();
        }
    }

    const handleEditCancle = async (pk: number) => {
        setComments(comments.map(comment => (
            comment.pk == pk ? ({
                ...comment,
                isEdit: false,
            }) : comment
        )));
    }

    useEffect(() => {
        const updateKey = Global.appendUpdater(() => {
            setIsLogin(Global.state.isLogin);
            setUsername(Global.state.username);
        });

        if (props.totalComment > 0) {
            const observer = lazyIntersection('.comments', () => {
                API.getPostComments(props.url).then((response) => {
                    setComments(response.data.body.comments.map(comment => ({
                        ...comment,
                        isEdit: false,
                        textMarkdown: '',
                    })));
                    lazyLoadResource();
                });
            });
    
            return () => {
                observer?.disconnect();
                Global.popUpdater('Comment');
            }
        } else {
            if (comments.length > 0) {
                setComments([]);
            }
        }

        return () => {
            Global.popUpdater(updateKey);
        }
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
                            timeSince="0분"
                            html="작성된 댓글이 없습니다. 첫 댓글을 달아보세요!"
                            isEdited={false}
                            isOwner={false}
                            totalLikes={0}
                            isLiked={false}
                            onEdit={() => {}}
                            onDelete={() => {}}
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
                            onClick={() => Global.onOpenModal('isLoginModalOpen')}
                        >
                            댓글을 작성하려면 로그인이 필요합니다.
                        </Alert>
                    )}
                </div>
            </div>
        </div>
    )
}