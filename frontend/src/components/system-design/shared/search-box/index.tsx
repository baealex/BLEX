import classNames from 'classnames/bind';
import styles from './SearchBox.module.scss';
const cn = classNames.bind(styles);

import {
    useCallback,
    useEffect,
    useRef,
    useState
} from 'react';

export interface SearchBoxProps {
    placeholder?: string;
    button: React.ReactNode;
    onClick?: (value?: string) => void;
    maxLength?: number;
    history?: {
        pk: number;
        value: string;
        createdDate: string;
    }[];
    onClickHistory?: (value: string) => void;
    onRemoveHistory?: (pk: number) => void;
}

export function SearchBox(props: SearchBoxProps) {
    const input = useRef<HTMLInputElement>(null);

    const [ active, setActive ] = useState(false);

    useEffect(() => {
        input.current?.focus();
    }, []);

    const handleClick = useCallback(() => {
        if (props.onClick) {
            props.onClick(input.current?.value);
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
                    placeholder={props.placeholder}
                    maxLength={props.maxLength}
                    onChange={(e) => {
                        if (e.currentTarget.value.length > 1) {
                            setActive(true);
                        } else {
                            setActive(false);
                        }
                    }}
                    onKeyPress={(e) => e.key === 'Enter' && handleClick()}
                />
                <button className={cn({ active })} onClick={handleClick}>
                    {props.button}
                </button>
            </div>
            {props.history && props.history.length > 0 && (
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
