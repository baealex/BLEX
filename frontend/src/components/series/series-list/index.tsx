import styles from './SeriesList.module.scss';
import classNames from 'classnames/bind';
const cn = classNames.bind(styles);

import Link from 'next/link';

export interface SeriesListProps {
    url: string;
    name: string;
    image: string;
    owner: string;
    createdDate: string;
}

export function SeriesList(props: SeriesListProps) {
    return (
        <div className={cn('card')} style={{backgroundImage: `url(${props.image})`}}>
            <Link href="/[author]/series/[seriesurl]" as={`/@${props.owner}/series/${props.url}`}>
                <a className={cn('title')}>
                    <div className={cn('mask')}>
                        <div className="h5 font-weight-bold">
                            ‘{props.name}’ 시리즈
                        </div>
                        <span className="ns">
                            {props.createdDate}
                        </span>
                    </div>
                </a>
            </Link>
        </div>
    )
}