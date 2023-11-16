import classNames from 'classnames/bind';
import styles from './Social.module.scss';
const cn = classNames.bind(styles);

import { getIconClassName } from '~/modules/utility/icon-class';

export interface SocialProps {
    username: string;
    social: {
        name: string;
        value: string;
    }[];
}

export function Social(props: SocialProps) {
    return (
        <ul className={cn('social')}>
            <li key={'rss'}>
                <a href={`/rss/@${props.username}`} data-name="rss">
                    <i className="fas fa-rss-square" />
                </a>
            </li>
            {props.social.map((item) => (
                <li key={item.value}>
                    <a href={item.value} data-name={item.name}>
                        <i className={getIconClassName(item.name)} />
                    </a>
                </li>
            ))}
        </ul>
    );
}