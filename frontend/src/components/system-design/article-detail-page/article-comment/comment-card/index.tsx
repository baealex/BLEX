import classNames from 'classnames/bind';
import styles from './CommentCard.module.scss';
const cx = classNames.bind(styles);

import Link from 'next/link';

import { Card, Dropdown, Flex, Text } from '~/components/design-system';
import { useEffect, useRef } from 'react';
import { codeMirrorAll } from '~/modules/library/codemirror';
import { lazyLoadResource } from '~/modules/optimize/lazy';

export interface CommentCardProps {
    id: number;
    author: string;
    authorImage: string;
    createdDate: string;
    isLiked: boolean;
    isEdited: boolean;
    isOwner?: boolean;
    countLikes: number;
    renderedContent: string;
    onClickLike?: (id: number) => void;
    onClickEdit?: (id: number) => void;
    onClickDelete?: (id: number) => void;
    onClickUserTag?: (username: string) => void;
}

export function CommentCard(props: CommentCardProps) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (ref.current) {
            codeMirrorAll(ref.current);
            lazyLoadResource(ref.current);
        }
    }, [ref, props.renderedContent]);

    return (
        <Card
            hasBackground
            isRounded
            hasShadow
            shadowLevel="sub"
            className={`${cx('card')}`}>
            <Flex justify="between">
                <Flex align="center">
                    <Link href={`/@${props.author}`}>
                        <div
                            className={`${cx('thumbnail')} back-image thumb`}
                            style={{ backgroundImage: `url(${props.authorImage})` }}
                        />
                    </Link>
                    <div>
                        <div>
                            <Link className="deep-dark" href={`/@${props.author}`}>
                                <Text fontWeight={600}>
                                    {props.author}
                                </Text>
                            </Link>
                        </div>
                        <div>
                            <small>
                                {`${props.createdDate}`} {props.isEdited && <span className="vs">(Edited)</span>}
                            </small>
                        </div>
                    </div>
                </Flex>
                {props.isOwner && (
                    <Dropdown
                        button={
                            <i className="fas fa-ellipsis-v" />
                        }
                        menus={[
                            {
                                name: '수정',
                                onClick: () => props.onClickEdit?.(props.id)
                            },
                            {
                                name: '삭제',
                                onClick: () => props.onClickDelete?.(props.id)
                            }
                        ]}
                    />
                )}
            </Flex>
            <div
                ref={ref}
                className={`${cx('content')} mt-4`}
                dangerouslySetInnerHTML={{ __html: props.renderedContent }}
            />
            <div className="my-2">
                <ul className={`${cx('action')} none-list ns`}>
                    {props.onClickLike && (
                        <li onClick={() => props.onClickLike?.(props.id)}>
                            {props.isLiked ? (
                                <i className="fas fa-heart" />
                            ) : (
                                <i className="far fa-heart" />
                            )} {props.countLikes}
                        </li>
                    )}
                    {props.onClickUserTag && !props.isOwner && (
                        <li onClick={() => props.onClickUserTag?.(props.author)}>
                            <i className="fas fa-reply" /> 사용자 태그
                        </li>
                    )}
                </ul>
            </div>
        </Card>
    );
}
