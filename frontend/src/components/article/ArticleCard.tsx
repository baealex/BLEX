import Link from 'next/link';

export interface ArticleCardProps {
    author: string;
    url: string;
    image: string;
    title: string;
    authorImage: string;
    createdDate: string;
    readTime: number;
}

export default function ArticleCard(props: ArticleCardProps) {
    return (
        <div className="col-lg-4 mt-4">
            <Link href="/[author]/[posturl]" as={`/@${props.author}/${props.url}`}>
                <a className="blex-card dee-dark">
                    <img className="list-image" src={props.image}/>
                </a>
            </Link>
            <Link href="/[author]/[posturl]" as={`/@${props.author}/${props.url}`}>
                <a className="deep-dark">
                    <h5 className="card-title serif font-weight-bold mt-3">
                        {props.title}
                    </h5>
                </a>
            </Link>
            <Link href="/[author]" as={`/@${props.author}`}>
                <a>
                    <div className="back-image thumb list-thumb" style={{backgroundImage: `url(${props.authorImage})`}}/>
                </a>
            </Link>
            <p className="vs serif">
                <Link href="/[author]" as={`/@${props.author}`}><a className="deep-dark">{props.author}</a></Link>님이 작성함<br/>{props.createdDate} · <span className="shallow-dark">{props.readTime} min read</span>
            </p>
        </div>
    )
}