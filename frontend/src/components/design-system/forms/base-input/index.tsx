import classNames from 'classnames/bind';
import styles from './BaseInput.module.scss';
const cx = classNames.bind(styles);

import { forwardRef } from 'react';

export type BaseInputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const BaseInput = forwardRef<HTMLInputElement, BaseInputProps>((props, ref) => {
    return (
        <input ref={ref} {...props} className={cx('input', props.className)} />
    );
});
