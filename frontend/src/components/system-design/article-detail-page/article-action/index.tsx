import classNames from 'classnames/bind';
import styles from './ArticleAction.module.scss';
const cn = classNames.bind(styles);

import {
    useEffect,
    useState
} from 'react';

import { Card, Flex, Text } from '~/components/design-system';

import * as API from '~/modules/api';
import { message } from '~/modules/utility/message';
import { snackBar } from '~/modules/ui/snack-bar';

import { modalStore } from '~/stores/modal';

export type ArticleActionProps = API.GetAnUserPostsViewResponseData;

export function ArticleAction(props: ArticleActionProps) {
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
        <div className={cn('actions')}>
            <Card
                hasShadow
                isRounded
                hasBackground
                backgroundType="background"
                className={cn('box')}>
                <Flex className="c-pointer shallow-dark" align="center" gap={2} onClick={onClickLike}>
                    <i className={`${state.isLiked ? 'fas' : 'far'} fa-heart`} />
                    <Text fontSize={3}>{state.countLikes}</Text>
                </Flex>
                <Flex className="c-pointer shallow-dark" align="center" gap={2} onClick={onClickGoComment}>
                    <i className="far fa-comment" />
                    <Text fontSize={3}>{state.countComments}</Text>
                </Flex>
            </Card>
        </div>
    );
}
