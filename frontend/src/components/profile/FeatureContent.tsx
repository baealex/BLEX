import Link from 'next/link';

import { Card } from '@components/atoms';
import PurpleBorder from '@components/shared/PurpleBorder';

interface FeautreContentProps {
    articles: FeatureCardProps[];
}

interface FeatureCardProps {
    author: string;
    url: string;
    title: string;
    image: string;
    createdDate: string;
    readTime: number;
}

export default function FeatureContent(props: FeautreContentProps) {
    return (
        <>
            <div className="h5 snotoerif font-weight-bold mt-5">Featured Contents</div>
            {props.articles.length > 0 ? (
                <div className="row mt-1 mb-5">
                    {props.articles.map((article, idx) => (
                        <FeatureCard key={idx} {...article}/>
                    ))}
                </div>
            ) : (
                <PurpleBorder text="아직 작성한 포스트가 없습니다."/>
            )}
        </>
    )
}

function FeatureCard(props: FeatureCardProps) {
    return (
        <div className="col-md-4 mt-3 noto">
            <Card isRounded>
                <Link href="/[author]/[posturl]" as={`@${props.author}/${props.url}`}>
                    <a className="deep-dark">
                        <img className="feature-image" src={props.image}/>
                        <div className="p-3">
                            {props.title}
                            <div className="vs noto mt-2">{props.createdDate} · <span className="shallow-dark">{props.readTime} min read</span></div>
                        </div>
                    </a>
                </Link>
            </Card>
        </div>
    )
}