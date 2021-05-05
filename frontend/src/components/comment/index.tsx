import {
    useState,
    useEffect,
} from 'react';

import CommentItem from '@components/comment/CommentItem';
import CommentEdit from '@components/comment/CommentEdit';
import CommentForm from '@components/comment/CommentForm';
import CommentAlert from '@components/comment/CommentAlert';

import { toast } from 'react-toastify';

import * as API from '@modules/api';
import Global from '@modules/global';
import blexer from '@modules/blexer';
import {
    lazyLoadResource,
    lazyIntersection
} from '@modules/lazy';

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

    const handleTag = async (username: string) => {
        if(!username) {
            toast('😅 로그인이 필요합니다.', {
                onClick: () => Global.onOpenModal('isLoginModalOpen')
            });
            return;
        }

        if(commentText.includes(`\`@${username}\``)) {
            toast(`😅 이미 ${username}님을 태그했습니다.`);
            return; 
        }

        setCommentText(commentText + ` \`@${username}\``);
        toast(`😀 ${username}님을 태그했습니다.`);
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
        Global.appendUpdater('Comment', () => {
            setIsLogin(Global.state.isLogin);
            setUsername(Global.state.username);
        });

        if (props.totalComment > 0) {
            const observer = lazyIntersection('.bg-comment', () => {
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
            if (comments) {
                setComments([]);
            }
        }

        return () => {
            Global.popUpdater('Comment');
        }
    }, [props.url]);

    return (
        <div className="py-5 bg-comment">
            <div className="container">
                <div className="col-lg-8 mx-auto px-0">
                    {comments && comments.length > 0 ? comments.map((comment, idx: number) => (
                        comment.isEdit ? (
                            <CommentEdit
                                key={comment.pk}
                                pk={comment.pk}
                                content={comment.textMarkdown}
                                onSubmit={handleEditSubmit}
                                onCancle={handleEditCancle}
                            />
                        ) : (
                            <CommentItem
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
                                onLike={handleLike}
                                onTag={handleTag}
                            />
                        )
                    )) : <CommentAlert
                            text={'😥 작성된 댓글이 없습니다!'}
                        />
                    }
                    {isLogin ? (
                        <CommentForm
                            content={commentText}
                            onChange={setCommentText}
                            onSubmit={handleSubmit}
                        />
                    ) : (
                        <div className="noto alert alert-warning s-shadow c-pointer" onClick={() => Global.onOpenModal('isLoginModalOpen')}>
                            댓글을 작성하기 위해 로그인이 필요합니다.
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}