import Link from 'next/link';

interface Props {
    idx: number;
    author: string;
    url: string;
    title: string;
    description: string;
    createdDate: string;
    readTime: number;
}

export default function ArticleCard(props: Props) {
    return (
        <div className="mb-4 blex-card">
            <div className="p-3">
                <h5 className="card-title noto font-weight-bold">
                    <Link href="/[author]/[posturl]" as={`/@${props.author}/${props.url}`}>
                        <a className="deep-dark">{props.idx + 1}. {props.title}</a>
                    </Link>
                </h5>
                <p>
                    <Link href="/[author]/[posturl]" as={`/@${props.author}/${props.url}`}>
                        <a className="shallow-dark noto">{props.description}</a>
                    </Link>
                </p>
                <p className="vs noto">{props.createdDate} · <span className="shallow-dark">{props.readTime} min read</span></p>
            </div>
        </div>
    )
}