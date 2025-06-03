import classNames from 'classnames/bind';
import styles from './ArticleAction.module.scss';
const cx = classNames.bind(styles);

import React, { useState, useEffect } from 'react';

import { Flex, Text } from '~/components/design-system';

import { modalStore } from '~/stores/modal';

import { message } from '~/modules/utility/message';
import { snackBar } from '~/modules/ui/snack-bar';

import * as API from '~/modules/api';
import { Comment, Heart } from '@baejino/icon';
import { ArticleReport } from '../article-report';

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
        const { author, url } = props;
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
            modalStore.open('isOpenAuthGetModal');
        }
    };

    const onClickGoComment = () => {
        window.scrollTo({
            top: window.pageYOffset + document.querySelector('.article')!.getBoundingClientRect().bottom,
            behavior: 'smooth'
        });
    };

    return (
        <div className={cx('actions')}>
            <Flex className="c-pointer shallow-dark" align="center" gap={2} onClick={onClickLike}>
                <Heart
                    className={state.isLiked ? cx('heart-beat') : ''}
                    width={20}
                    height={20}
                />
                <Text fontSize={3}>{state.countLikes}</Text>
            </Flex>
            <Flex className="c-pointer shallow-dark" align="center" gap={2} onClick={onClickGoComment}>
                <Comment width={20} height={20} />
                <Text fontSize={3}>{state.countComments}</Text>
            </Flex>
            <ArticleReport url={props.url} />
        </div>
    );
}
