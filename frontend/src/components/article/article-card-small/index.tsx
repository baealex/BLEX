import styles from './ArticleCardSmall.module.scss';
import classNames from 'classnames';

import Link from 'next/link';

import { Card } from '@components/atoms';

export interface ArticleCardSmallProps {
    author: string;
    url: string;
    title: string;
    image: string;
    createdDate: string;
    readTime: number;
}

export function ArticleCardSmall(props: ArticleCardSmallProps) {
    return (
        <div className="col-md-4 mt-3 noto">
            <Card isRounded>
                <Link href="/[author]/[posturl]" as={`@${props.author}/${props.url}`}>
                    <a className="deep-dark">
                        <img
                            className={classNames(
                                styles.image,
                                'lazy'
                            )}
                            src={props.image + '.preview.jpg'}
                            data-src={props.image}
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
            </Card>
        </div>
    )
}