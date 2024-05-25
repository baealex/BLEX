import classNames from 'classnames/bind';
import styles from './Social.module.scss';
const cx = classNames.bind(styles);

import { getIconClassName } from '~/modules/utility/icon-class';

export interface SocialProps {
    username: string;
    homepage?: string;
    social?: {
        name: string;
        value: string;
    }[];
}

const replaceProtocol = (text: string) => {
    return text.replace(/(^\w+:|^)\/\//, '');
};

export function Social(props: SocialProps) {
    return (
        <ul className={cx('social')}>
            <li key={'rss'}>
                <a href={`/rss/@${props.username}`} data-name="rss">
                    <i className="fas fa-rss-square" /> {`rss/@${props.username}`}
                </a>
            </li>
            {props.homepage && (
                <li>
                    <a href={`${props.homepage}`}>
                        <i className="fas fa-link"/> {replaceProtocol(props.homepage)}
                    </a>
                </li>
            )}
            {props.social?.map((item) => (
                <li key={item.value}>
                    <a href={item.value} data-name={item.name}>
                        <i className={getIconClassName(item.name)} /> {replaceProtocol(item.value)}
                    </a>
                </li>
            ))}
        </ul>
    );
}
