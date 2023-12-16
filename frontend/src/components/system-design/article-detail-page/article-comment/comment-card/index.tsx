import classNames from 'classnames/bind';
import styles from './CommentCard.module.scss';
const cn = classNames.bind(styles);

import Link from 'next/link';

import { Card, Dropdown, Text } from '@design-system';

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
    return (
        <Card
            isRounded
            hasShadow
            shadowLevel="sub"
            hasBackground
            backgroundType="background"
            className={`${cn('card')} mb-3`}>
            <div className="d-flex justify-content-between">
                <div className="d-flex align-items-center">
                    <Link href={`/@${props.author}`}>
                        <div
                            className={`${cn('thumbnail')} back-image thumb`}
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
                </div>
                {props.isOwner && (
                    <Dropdown
                        button={
                            <i className="fas fa-ellipsis-v"></i>
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
            </div>
            <div
                className={`${cn('content')} mt-4`}
                dangerouslySetInnerHTML={{ __html: props.renderedContent }}
            />
            <div className="my-2">
                <ul className={`${cn('action')} none-list ns`}>
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
