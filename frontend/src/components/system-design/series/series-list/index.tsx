import classNames from 'classnames/bind';
import styles from './SeriesList.module.scss';
const cn = classNames.bind(styles);

import Link from 'next/link';
import { Text } from '~/components/design-system';

import { getPostsImage } from '~/modules/utility/image';

export interface SeriesListProps {
    url: string;
    name: string;
    image: string;
    owner: string;
    createdDate: string;
}

export function SeriesList(props: SeriesListProps) {
    return (
        <div
            className={cn('card')}
            style={{ backgroundImage: `url(${getPostsImage(props.image, { title: props.name })})` }}>
            <Link className={cn('title')} href="/[author]/series/[seriesurl]" as={`/@${props.owner}/series/${props.url}`}>
                <div className={cn('mask')}>
                    <Text className="mb-2" fontSize={6} fontWeight={600}>
                        ‘{props.name}’ 시리즈
                    </Text>
                    <span className="ns">
                        {props.createdDate}
                    </span>
                </div>
            </Link>
        </div>
    );
}
