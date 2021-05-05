import Link from 'next/link'

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
            <div className="comment-list s-shadow noto mb-1">
                <Link href={`/@${props.author}`}>
                    <a><div className="back-image thumb comment-thumb" style={{backgroundImage: `url(${props.authorImage})`}}/></a>
                </Link>
                <Link href={`/@${props.author}`}>
                    <a className="font-weight-bold deep-dark">{props.author}</a>
                </Link>
                <br/>
                <small>{`${props.timeSince}전`} {props.isEdited && <span className="vs">(Edited)</span>}</small>
                <div className="mt-4 comment-content" dangerouslySetInnerHTML={{ __html: props.html }}/>
            </div>
            <div className="mb-3 mt-2 px-2">
                <ul className="none-list noto ns">
                    <li className="c-pointer" onClick={() => props.onLike(props.pk)}>
                        {props.isLiked ? (
                            <i className="fas fa-heart"/>
                        ) : (
                            <i className="far fa-heart"/>
                        )} {props.totalLikes}
                    </li>
                    {props.isOwner ? (
                        <>
                            <li className="c-pointer ml-3" onClick={() => props.onEdit(props.pk)}>
                                <i className="far fa-edit"/> 수정
                            </li>
                            <li className="c-pointer float-right" onClick={() => props.onDelete(props.pk)}>
                                <i className="far fa-trash-alt"/> 삭제
                            </li>
                        </>
                    ) : (
                        <>
                            <li className="c-pointer ml-3" onClick={() => props.onTag(props.author)}>
                                <i className="fas fa-reply"/> 사용자 태그
                            </li>
                        </>
                    )}
                </ul>
            </div>
        </>
    )
}