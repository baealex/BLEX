import styles from './ArticleAction.module.scss';
import classNames from 'classnames/bind';
const cn = classNames.bind(styles);

import { useEffect, useState } from 'react';

import * as API from '@modules/api';
import { snackBar } from '@modules/ui/snack-bar';

import { modalContext } from '@state/modal';

export interface ArticleActionProps extends API.GetAnUserPostsViewData {}

type Social = 'twitter' | 'facebook' | 'pinterest';

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
    
    const onClickShare = (social: Social) => {
        let href = '';
        let size = '';
        switch(social) {
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
        window.open(href, `${social}-share`, size);
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

    const onClickGoComment = () => {
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
                        <li className="mx-3 mx-lg-4" onClick={onClickLike}>
                            <i className={`${state.isLiked ? 'fas' : 'far'} fa-heart`}/>
                            <span>{state.totalLikes}</span>
                        </li>
                        <li className="mx-3 mx-lg-4" onClick={onClickGoComment}>
                            <i className="far fa-comment"/>
                            <span>{state.totalComment}</span>
                        </li>
                        {['twitter', 'facebook', 'pinterest'].map((social, idx) => (
                            <li
                                key={idx}
                                className="mx-3 mx-lg-4"
                                onClick={() => onClickShare(social as Social)}
                            >
                                <i className={`fab fa-${social}`}/>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
            <div className={cn('m')}>
                <div className={cn('bottom-nav')}>
                    <div className={cn('d-flex')}>
                        <div className={cn('item')} onClick={onClickLike}>
                            <i className={`${state.isLiked ? 'fas' : 'far'} fa-heart`}></i>
                            <span>{state.totalLikes}</span>
                        </div>
                        <div className={cn('item')} onClick={onClickGoComment}>
                            <i className="far fa-comment"></i>
                            <span>{state.totalComment}</span>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}