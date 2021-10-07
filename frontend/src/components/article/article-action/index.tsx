import styles from './ArticleAction.module.scss';
import classNames from 'classnames/bind';
const cn = classNames.bind(styles);

import { useEffect, useState } from 'react';
import { snackBar } from '@modules/snack-bar';

import * as API from '@modules/api';

import { modalContext } from '@state/modal';

export interface ArticleActionProps extends API.GetAnUserPostsViewData {

}

export function ArticleAction(props: ArticleActionProps) {
    const [ state, setState ] = useState({
        isLiked: props.isLiked,
        totalLikes: props.totalLikes,
        totalComment: props.totalComment,
    });

    useEffect(() => {
        setState({
            isLiked: props.isLiked,
            totalLikes: props.totalLikes,
            totalComment: props.totalComment,
        });
    }, [props])
    
    const onClickShare = (sns: 'twitter' | 'facebook' | 'pinterest') => {
        let href = '';
        let size = '';
        switch(sns) {
            case 'twitter':
                href = `https://twitter.com/intent/tweet?text=${props.title}&url=${window.location.href}`;
                size = 'width=550,height=235';
                break;
            case 'facebook':
                href = `https://facebook.com/sharer.php?u=${window.location.href}`;
                size = 'width=550,height=435';
                break;
            case 'pinterest':
                href = `https://pinterest.com/pin/create/button/?url=${window.location.href}&media=${props.image}&description=${props.description}`
                size = 'width=650,height=500';
                break;
        }
        window.open(href, `${sns}-share`, size);
    }

    const onClickLike = async () => {
        const { author, url } = props;
        const { data } = await API.putAnUserPosts('@' + author, url, 'like');
        if (data.status === 'DONE') {
            if (typeof data.body.totalLikes === 'number') {
                setState((prevState) => ({
                    ...prevState,
                    isLiked: !prevState.isLiked,
                    totalLikes: data.body.totalLikes || 0,
                }));
            }
        }
        if (data.status === 'ERROR') {
            if (data.errorCode === API.ERROR.NOT_LOGIN) {
                snackBar('😅 로그인이 필요합니다.', {
                    onClick:() => {
                        modalContext.onOpenModal('isLoginModalOpen');
                    }
                });
            }
            if (data.errorCode === API.ERROR.SAME_USER) {
                snackBar('😅 자신의 글은 추천할 수 없습니다.');
            }
        }
    }

    const onClickComment = () => {
        window.scrollTo({
            top: window.pageYOffset + document.querySelector('.comments')!.getBoundingClientRect().top - 15,
            behavior: 'smooth'
        });
    }

    return (
        <>
            <div className={classNames(cn('pc'), 'sticky-top sticky-top-200 mb-5')}>
                <div className={cn('actions')}>
                    <ul className="px-3">
                        <li className="mx-3 mx-lg-4" onClick={() => onClickLike()}>
                            <i className={`${state.isLiked ? 'fas' : 'far'} fa-heart`}></i>
                            <span>{state.totalLikes}</span>
                        </li>
                        <li className="mx-3 mx-lg-4" onClick={() => onClickComment()}>
                            <i className="far fa-comment"></i>
                            <span>{state.totalComment}</span>
                        </li>
                        <li className="mx-3 mx-lg-4" onClick={() => onClickShare('twitter')}>
                            <i className="fab fa-twitter"></i>
                        </li>
                        <li className="mx-3 mx-lg-4" onClick={() => onClickShare('facebook')}>
                            <i className="fab fa-facebook"></i>
                        </li>
                        <li className="mx-3 mx-lg-4" onClick={() => onClickShare('pinterest')}>
                            <i className="fab fa-pinterest"></i>
                        </li>
                    </ul>
                </div>
            </div>
            <div className={cn('m')}>
                <div className={cn('bottom-nav')}>
                    <div className={cn('container')}>
                        <div className={cn('d-flex', 'justify-content-between')}>
                            <div className={cn('item')} onClick={() => onClickLike()}>
                                <i className={`${state.isLiked ? 'fas' : 'far'} fa-heart`}></i>
                                <span>{state.totalLikes}</span>
                            </div>
                            <div className={cn('item')} onClick={() => onClickComment()}>
                                <i className="far fa-comment"></i>
                                <span>{state.totalComment}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}