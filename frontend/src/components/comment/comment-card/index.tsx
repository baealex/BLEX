import styles from './CommentCard.module.scss';
import classNames from 'classnames/bind';
const cn = classNames.bind(styles);

import Link from 'next/link';

import {
    Dropdown,
} from '@components/integrated';

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
};

export function CommentCard(props: CommentCardProps) {
    return (
        <>
            <div className={`${cn('card')} mb-3`}>
                <div className="d-flex justify-content-between">
                    <div className="d-flex">
                        <Link href={`/@${props.author}`}>
                            <a>
                                <div
                                    className={`${cn('thumbnail')} back-image thumb`}
                                    style={{backgroundImage: `url(${props.authorImage})`}}
                                />
                            </a>
                        </Link>
                        <div>
                            <div>
                                <Link href={`/@${props.author}`}>
                                    <a className="font-weight-bold deep-dark">{props.author}</a>
                                </Link>
                            </div>
                            <div>
                                <small>
                                    {`${props.timeSince}전`} {props.isEdited && <span className="vs">(Edited)</span>}
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
                            <>
                                <li className="float-right" onClick={() => props.onTag && props.onTag(props.author)}>
                                    <i className="fas fa-reply"/> 사용자 태그
                                </li>
                            </>
                        )}
                    </ul>
                </div>
            </div>
        </>
    )
}