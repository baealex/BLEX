import styles from './SearchBox.module.scss';
import classNames from 'classnames/bind';
const cn = classNames.bind(styles);

import { useCallback, useEffect, useRef } from 'react';

export interface SearchBoxProps {
    value: string;
    placeholder?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    button: any;
    onClick?: () => void;
    maxLength?: number;
}

export function SearchBox(props: SearchBoxProps) {
    const input = useRef<HTMLInputElement>(null);

    useEffect(() => {
        input.current?.focus();
    }, []);

    const handleClick = useCallback(() => {
        if (props.onClick) {
            props.onClick();
        }
    }, [props.onClick]);

    return (
        <div className={cn('input-group')}>
            <input
                ref={input}
                value={props.value}
                placeholder={props.placeholder}
                maxLength={props.maxLength}
                onChange={props.onChange}
                onKeyPress={(e) => e.key === 'Enter' && handleClick()}
            />
            <button className={cn({'show' : props.value})} onClick={handleClick}>
                {props.button}
            </button>
        </div>
    )
}