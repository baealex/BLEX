import classNames from 'classnames/bind';
import styles from './ArticleLayout.module.scss';
const cx = classNames.bind(styles);

interface Props {
    action: React.ReactNode;
    content: React.ReactNode;
    navigation: React.ReactNode;
}

export function ArticleLayout(props: Props) {
    return (
        <div className={cx('container', 'layout')}>
            <div className={cx('action')}>
                {props.action}
            </div>
            <div className={cx('content')}>
                {props.content}
            </div>
            <div className={cx('navigation')}>
                {props.navigation}
            </div>
        </div>
    );
}
