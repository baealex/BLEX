import Link from 'next/link'

interface CommentProps {
    pk: number;
    author: string;
    authorImage: string;
    timeSince: string;
    isEdited: boolean;
    isOwner: boolean;
    onEdit: Function;
    onDelete: Function;
    html: string;
};

export default function Comment(props: CommentProps) {
    return (
        <>
            <div className="comment-list s-shadow">
                <Link href={`/@${props.author}`}>
                    <a><div className="back-image thumb comment-thumb" style={{backgroundImage: `url(${props.authorImage})`}}/></a>
                </Link>
                <Link href={`/@${props.author}`}>
                    <a className="font-weight-bold deep-dark">{props.author}</a>
                </Link>
                <br/>
                <small>{`${props.timeSince}전`} {props.isEdited ? <span className="vs">(Edited)</span> : ''}</small>
                {props.isOwner ? (
                    <ul className="none-list">
                        <li className="ml-1">
                            <a className="vs shallow-dark c-pointer" onClick={() => props.onEdit(props.pk)}>수정</a>
                        </li>
                        <li className="ml-1">
                            <a className="vs shallow-dark c-pointer" onClick={() => props.onDelete(props.pk)}>삭제</a>
                        </li>
                    </ul>
                ) : ''}
                <div className="mt-4 comment-content" dangerouslySetInnerHTML={{ __html: props.html }}/>
            </div>
        </>
    )
}