import classNames from 'classnames/bind';
import styles from './SearchBox.module.scss';
const cn = classNames.bind(styles);

import {
    useCallback,
    useEffect,
    useRef
} from 'react';

export interface SearchBoxProps {
    value: string;
    placeholder?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    button: React.ReactNode;
    onClick?: () => void;
    maxLength?: number;
    history: {
        pk: number;
        value: string;
        createdDate: string;
    }[];
    onClickHistory?: (value: string) => void;
    onRemoveHistory?: (pk: number) => void;
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

    const handleClickHistory = useCallback((value: string) => {
        if (props.onClickHistory) {
            props.onClickHistory(value);
        }
    }, [props.onClickHistory]);

    const handleRemoveHistory = useCallback((pk: number) => {
        if (props.onRemoveHistory) {
            props.onRemoveHistory(pk);
        }
    }, [props.onRemoveHistory]);

    return (
        <>
            <div className={cn('input-group')}>
                <input
                    ref={input}
                    type="search"
                    value={props.value}
                    placeholder={props.placeholder}
                    maxLength={props.maxLength}
                    onChange={props.onChange}
                    onKeyPress={(e) => e.key === 'Enter' && handleClick()}
                />
                <button
                    className={cn({ 'show' : props.value })}
                    onClick={handleClick}>
                    {props.button}
                </button>
            </div>
            {props.history.length > 0 && (
                <div className={cn('histories')}>
                    <div className={cn('recent')}>
                        <span>
                            최근 검색어
                        </span>
                    </div>
                    {props.history.map(item => (
                        <div className={cn('history')}>
                            <span onClick={() => handleClickHistory(item.value)}>
                                {item.value} <small className="shallow-dark">{item.createdDate}</small>
                            </span>
                            <span onClick={() => handleRemoveHistory(item.pk)}>
                                <i className="fas fa-times"/>
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}