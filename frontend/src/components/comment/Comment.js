import Link from 'next/link'

export default function Comment(props) {
    return (
        <>
            <div className="comment-list">
                <Link href={`/@${props.author}`}>
                    <a><div className="back-image thumb comment-thumb" style={{backgroundImage: `url(${props.authorImage})`}}/></a>
                </Link>
                <Link href={`/@${props.author}`}>
                    <a>{props.author}</a>
                </Link>
                <div className="comment-content" dangerouslySetInnerHTML={{ __html: props.html }}/>
            </div>
        </>
    )
}