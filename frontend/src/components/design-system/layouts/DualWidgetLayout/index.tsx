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
            <div className={cx('left-widget')}>
                {props.leftWidget}
            </div>
            <div className={cx('content')}>
                {props.content}
            </div>
            <div className={cx('right-widget')}>
                {props.rightWidget}
            </div>
        </div>
    );
}
