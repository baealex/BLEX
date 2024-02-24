import classNames from 'classnames/bind';
import styles from './Label.module.scss';
const cx = classNames.bind(styles);

export interface LabelProps {
    className?: string;
    required?: boolean;
    children: string;
}

export function Label(props: LabelProps) {
    return (
        <label className={cx('label', props.className)}>
            {props.children}
            {props.required && (
                <span className={cx('required')}>
                    *
                </span>
            )}
        </label>
    );
}
