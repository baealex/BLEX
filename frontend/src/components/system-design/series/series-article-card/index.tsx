import { Card } from '@design-system';
import Link from 'next/link';

export interface SeriesArticleCardProps {
    idx: number;
    author: string;
    url: string;
    title: string;
    description: string;
    createdDate: string;
    readTime: number;
}

export function SeriesArticleCard(props: SeriesArticleCardProps) {
    return (
        <Card hasShadow isRounded className="mb-4">
            <div className="p-3">
                <h5 className="card-title font-weight-bold">
                    <Link href="/[author]/[posturl]" as={`/@${props.author}/${props.url}`}>
                        <a className="deep-dark">{props.idx + 1}. {props.title}</a>
                    </Link>
                </h5>
                <p>
                    <Link href="/[author]/[posturl]" as={`/@${props.author}/${props.url}`}>
                        <a className="shallow-dark">{props.description}</a>
                    </Link>
                </p>
                <p className="vs">{props.createdDate} · <span className="shallow-dark">{props.readTime} min read</span></p>
            </div>
        </Card>
    );
}