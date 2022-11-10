import classNames from 'classnames/bind';
import styles from './CommentCard.module.scss';
const cn = classNames.bind(styles);

import Link from 'next/link';

import { Card, Dropdown, Text } from '@design-system';

export interface CommentCardProps {
    pk: number;
    author: string;
    authorImage: string;
    timeSince: string;
    isLiked: boolean;
    isEdited: boolean;
    isOwner: boolean;
    onLike?: (pk: number) => void;
    onEdit: (pk: number) => void;
    onDelete: (pk: number) => void;
    onTag?: (username: string) => void;
    html: string;
    totalLikes: number;
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
                        <a>
                            <div
                                className={`${cn('thumbnail')} back-image thumb`}
                                style={{ backgroundImage: `url(${props.authorImage})` }}
                            />
                        </a>
                    </Link>
                    <div>
                        <div>
                            <Link href={`/@${props.author}`}>
                                <a className="deep-dark">
                                    <Text fontWeight={600}>
                                        {props.author}
                                    </Text>
                                </a>
                            </Link>
                        </div>
                        <div>
                            <small>
                                {`${props.timeSince} ago`} {props.isEdited && <span className="vs">(Edited)</span>}
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
                                onClick: () => props.onEdit(props.pk)
                            },
                            {
                                name: '삭제',
                                onClick: () => props.onDelete(props.pk)
                            }
                        ]}
                    />
                )}
            </div>
            <div
                className={`${cn('content')} mt-4`}
                dangerouslySetInnerHTML={{ __html: props.html }}
            />
            <div className="my-2">
                <ul className={`${cn('interactive')} none-list ns`}>
                    {props.onLike && (
                        <li onClick={() => props.onLike && props.onLike(props.pk)}>
                            {props.isLiked ? (
                                <i className="fas fa-heart"/>
                            ) : (
                                <i className="far fa-heart"/>
                            )} {props.totalLikes}
                        </li>
                    )}
                    {props.onTag && !props.isOwner && (
                        <li onClick={() => props.onTag && props.onTag(props.author)}>
                            <i className="fas fa-reply"/> 사용자 태그
                        </li>
                    )}
                </ul>
            </div>
        </Card>
    );
}
