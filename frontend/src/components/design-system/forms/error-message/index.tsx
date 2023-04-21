import classNames from 'classnames/bind';
import styles from './ErrorMessage.module.scss';
const cx = classNames.bind(styles);

export interface ErrorMessageProps {
    className?: string;
    children: string;
}

export function ErrorMessage(props: ErrorMessageProps) {
    return (
        <div className={cx('error-message', props.className)}>
            {props.children}
        </div>
    );
}