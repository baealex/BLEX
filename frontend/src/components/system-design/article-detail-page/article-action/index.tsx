import classNames from 'classnames/bind';
import styles from './ArticleAction.module.scss';
const cn = classNames.bind(styles);

import {
    useEffect,
    useState
} from 'react';
import { useStore } from 'badland-react';

import * as API from '~/modules/api';
import { message } from '~/modules/utility/message';
import { snackBar } from '~/modules/ui/snack-bar';

import { authStore } from '~/stores/auth';
import { modalStore } from '~/stores/modal';

export type ArticleActionProps = API.GetAnUserPostsViewResponseData;

type Social = 'twitter' | 'facebook' | 'pinterest';

export function ArticleAction(props: ArticleActionProps) {
    const [{ isLogin }] = useStore(authStore);
    const [state, setState] = useState({
        isLiked: props.isLiked,
        countLikes: props.countLikes,
        countComments: props.countComments
    });

    useEffect(() => {
        setState({
            isLiked: props.isLiked,
            countLikes: props.countLikes,
            countComments: props.countComments
        });
    }, [props]);

    const onClickShare = (social: Social) => {
        let href = '';
        let size = '';
        switch (social) {
            case 'twitter':
                href = `https://twitter.com/intent/tweet?text=${props.title}&url=${window.location.href}`;
                size = 'width=550,height=235';
                break;
            case 'facebook':
                href = `https://facebook.com/sharer.php?u=${window.location.href}`;
                size = 'width=550,height=435';
                break;
            case 'pinterest':
                href = `https://pinterest.com/pin/create/button/?url=${window.location.href}&media=${props.image}&description=${props.description}`;
                size = 'width=650,height=500';
                break;
        }
        window.open(href, `${social}-share`, size);
    };

    const onClickLike = async () => {
        const {
            author, url
        } = props;
        const { data } = await API.putAnUserPosts('@' + author, url, 'like');
        if (data.status === 'DONE') {
            if (typeof data.body.countLikes === 'number') {
                setState((prevState) => {
                    prevState.isLiked
                        ? snackBar(message('AFTER_REQ_DONE', '관심 포스트에서 제거되었습니다.'))
                        : snackBar(message('AFTER_REQ_DONE', '관심 포스트에 추가되었습니다.'));

                    return {
                        ...prevState,
                        isLiked: !prevState.isLiked,
                        countLikes: data.body.countLikes || 0
                    };
                });
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
        }
    };

    const onClickGoComment = () => {
        window.scrollTo({
            top: window.pageYOffset + document.querySelector('.comments')!.getBoundingClientRect().top - 15,
            behavior: 'smooth'
        });
    };

    return (
        <aside className={cn('actions')}>
            <ul>
                {isLogin && (
                    <li onClick={onClickLike}>
                        <i className={`${state.isLiked ? 'fas' : 'far'} fa-heart`} />
                        <span>{state.countLikes}</span>
                    </li>
                )}
                <li onClick={onClickGoComment}>
                    <i className="far fa-comment" />
                    <span>{state.countComments}</span>
                </li>
                {['twitter', 'facebook', 'pinterest'].map((social, idx) => (
                    <li
                        key={idx}
                        onClick={() => onClickShare(social as Social)}>
                        <i className={`fab fa-${social}`} />
                    </li>
                ))}
            </ul>
        </aside>
    );
}
