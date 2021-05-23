import styles from './Comment.module.scss';
import classNames from 'classnames/bind';
const cn = classNames.bind(styles);

import Link from 'next/link';

import {
    Dropdown,
} from '@components/integrated';

interface Props {
    pk: number;
    author: string;
    authorImage: string;
    timeSince: string;
    isLiked: boolean;
    isEdited: boolean;
    isOwner: boolean;
    onLike: (pk: number) => void;
    onEdit: (pk: number) => void;
    onDelete: (pk: number) => void;
    onTag: (username: string) => void;
    html: string;
    totalLikes: number;
};

export default function Comment(props: Props) {
    return (
        <>
            <div className={`${cn('comment')} noto mb-3`} style={{borderRadius: '8px'}}>
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
                    <ul className={`${cn('sub-item')} none-list noto ns`}>
                        <li onClick={() => props.onLike(props.pk)}>
                            {props.isLiked ? (
                                <i className="fas fa-heart"/>
                            ) : (
                                <i className="far fa-heart"/>
                            )} {props.totalLikes}
                        </li>
                        {!props.isOwner && (
                            <>
                                <li className="float-right" onClick={() => props.onTag(props.author)}>
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