import classNames from 'classnames/bind';
import styles from './BaseInput.module.scss';
const cx = classNames.bind(styles);

import React, { forwardRef, useCallback, useRef } from 'react';

interface BaseInputCommon {
    icon?: React.ReactNode;
}

interface BaseInputText extends React.InputHTMLAttributes<HTMLInputElement> {
    tag: 'input' | 'textarea';
}

interface BaseInputSelect extends React.InputHTMLAttributes<HTMLSelectElement> {
    tag: 'select';
    children?: React.ReactNode;
}

export type BaseInputProps = BaseInputCommon & (BaseInputText | BaseInputSelect);

export const BaseInput = forwardRef<HTMLInputElement, BaseInputProps>((props, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);

    const handleClickContainer = useCallback(() => {
        containerRef.current?.querySelector('input')?.focus();
    }, []);

    return (
        <div ref={containerRef} className={cx('container', props.className)} onClick={handleClickContainer}>
            {props.icon && (
                <div className={cx('icon')}>
                    {props.icon}
                </div>
            )}
            {React.createElement(props.tag, {
                ref,
                ...props,
                tag: undefined,
                className: cx('input', props.className)
            }, props.children)}
        </div>
    );
});
