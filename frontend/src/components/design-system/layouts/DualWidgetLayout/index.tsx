import classNames from 'classnames/bind';
import styles from './DualWidgetLayout.module.scss';
const cx = classNames.bind(styles);

interface Props {
    leftWidget: React.ReactNode;
    rightWidget: React.ReactNode;
    content: React.ReactNode;
}

export function DualWidgetLayout(props: Props) {
    return (
        <div className={cx('layout')}>
            <aside className={cx('left-widget')}>
                {props.leftWidget}
            </aside>
            <div className={cx('content')}>
                {props.content}
            </div>
            <aside className={cx('right-widget')}>
                {props.rightWidget}
            </aside>
        </div>
    );
}
