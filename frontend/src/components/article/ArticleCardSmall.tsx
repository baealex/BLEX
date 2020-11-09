import Link from 'next/link';

export interface ArticleCardSmallProps {
    author: string;
    url: string;
    image: string;
    title: string;
    authorImage: string;
    createdDate: string;
    readTime: number;
}

export default function ArticleCardSmall(props: ArticleCardSmallProps) {
    return (
        <div>
            <Link href="/[author]/[posturl]" as={`/@${props.author}/${props.url}`}>
                <a className="deep-dark">
                    <h6 className="card-title serif font-weight-bold mt-3">
                        {props.title}
                    </h6>
                </a>
            </Link>
            <p className="vs serif">
                <Link href="/[author]" as={`/@${props.author}`}><a className="deep-dark">{props.author}</a></Link>님이 작성함<br/>{props.createdDate} · <span className="shallow-dark">{props.readTime} min read</span>
            </p>
        </div>
    )
}