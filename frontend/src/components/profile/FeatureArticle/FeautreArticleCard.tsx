import Link from 'next/link';

export interface FeautreArticleCardProps {
    author: string;
    url: string;
    title: string;
    image: string;
    createdDate: string;
    readTime: number;
}

export default function FeautreArticleCard(props: FeautreArticleCardProps) {
    return (
        <div className="col-md-4 mt-3">
            <div className="blex-card noto">
                <Link href="/[author]/[posturl]" as={`@${props.author}/${props.url}`}>
                    <a className="deep-dark">
                        <img className="feature-image" src={props.image}/>
                        <div className="p-3">
                            {props.title}
                            <div className="vs noto mt-2">{props.createdDate} · <span className="shallow-dark">{props.readTime} min read</span></div>
                        </div>
                    </a>
                </Link>
            </div>
        </div>
    )
}