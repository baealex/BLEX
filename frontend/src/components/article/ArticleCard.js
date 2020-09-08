import Link from 'next/link'

export default function ArticleCard(props) {
    return (
        <div className="col-lg-4 mt-4">
            <Link href="/[author]/[posturl]" as={`/@${props.author}/${props.url}`}>
                <a className="blex-card dee-dark">
                    <img className="list-image" src={`https://static.blex.me/${props.image}`}/>
                </a>
            </Link>
            <Link href="/[author]/[posturl]" as={`/@${props.author}/${props.url}`}>
                <a className="deep-dark">
                    <h5 className="card-title serif font-weight-bold mt-3">
                        {props.title}
                    </h5>
                </a>
            </Link>
            <a>
                <div className="back-image thumb list-thumb" style={{backgroundImage: `url(${props.authorImage})`}}/>
            </a>
            <p className="vs serif">
                <Link href="/[author]" as={`/@${props.author}`}><a className="deep-dark">{props.author}</a></Link>님이 작성함<br/>{props.createdDate} · <span className="shallow-dark">{props.readTime} min read</span>
            </p>
        </div>
    )
}