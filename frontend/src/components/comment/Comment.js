import Link from 'next/link'

export default function Comment(props) {
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
                <small>{`${props.timeSince}전${props.edited === 'true' ? (<span className='vs'> (Edited)</span>) : ''}`}</small>
                <div className="mt-4 comment-content" dangerouslySetInnerHTML={{ __html: props.html }}/>
            </div>
        </>
    )
}