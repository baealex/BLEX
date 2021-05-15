import styles from './FeatureArticleCard.module.scss';

import Link from 'next/link';
import Image from 'next/image';

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
                        <Image
                            className={styles.image}
                            src={props.image}
                            width="600"
                            height="400"
                        />
                        <div className="p-3">
                            <div>
                                {props.title}
                            </div>
                            <div className="vs noto mt-2">
                                {props.createdDate} · <span className="shallow-dark">{props.readTime} min read</span>
                            </div>
                        </div>
                    </a>
                </Link>
            </div>
        </div>
    )
}