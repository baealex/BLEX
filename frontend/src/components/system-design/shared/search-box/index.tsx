import classNames from 'classnames/bind';
import styles from './SearchBox.module.scss';
const cn = classNames.bind(styles);

import * as API from '~/modules/api';

import {
    useCallback,
    useEffect,
    useRef,
    useState
} from 'react';

export interface SearchBoxProps {
    placeholder?: string;
    defaultValue?: string;
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

const memoSuggestions: Map<string, string[]> = new Map();

export function SearchBox(props: SearchBoxProps) {
    const form = useRef<HTMLFormElement>(null);

    const [value, setValue] = useState(props.defaultValue || '');
    const [active, setActive] = useState(false);
    const [suggestions, setSuggestions] = useState<string[]>([]);

    const handleClick = useCallback(() => {
        if (props.onClick) {
            props.onClick(value);
        }
    }, [props.onClick, value]);

    const handleSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (props.onClick) {
            props.onClick(value);
        }
    }, [props.onClick, value]);

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

    useEffect(() => {
        if (props.maxLength) {
            const input = form.current?.querySelector('input');
            if (input) {
                input.focus();
                input.setSelectionRange(value.length, value.length);
            }
        }
    }, []);

    useEffect(() => {
        if (!value || value === props.defaultValue) {
            setSuggestions([]);
            return;
        }

        if (memoSuggestions.has(value)) {
            setSuggestions(memoSuggestions.get(value)!);
            return;
        }

        const debounce = setTimeout(() => {
            if (value.length > 0) {
                API.getSearchSuggestion(value).then(({ data }) => {
                    memoSuggestions.set(value, data.body.results);
                    setSuggestions(data.body.results);
                });
            }
        }, 300);

        return () => {
            clearTimeout(debounce);
        };
    }, [value]);


    return (
        <form ref={form} onSubmit={handleSubmit}>
            <div className={cn('input-group')}>
                <input
                    type="search"
                    value={value}
                    placeholder={props.placeholder}
                    maxLength={props.maxLength}
                    onChange={(e) => {
                        setValue(e.currentTarget.value);
                        if (e.currentTarget.value.length > 1) {
                            setActive(true);
                        } else {
                            setActive(false);
                        }
                    }}
                />
                <button className={cn({ active })} onClick={handleClick}>
                    {props.button}
                </button>
            </div>
            <div className={cn('histories')}>
                {suggestions && suggestions.length > 0 && (
                    <>
                        <div className={cn('suggestion')}>
                            <span>
                                추천 검색어
                            </span>
                        </div>
                        {suggestions.map(item => (
                            <div key={item} className={cn('history')}>
                                <span onClick={() => handleClickHistory(item)}>
                                    {item}
                                </span>
                            </div>
                        ))}
                    </>
                )}
                {props.history && props.history.length > 0 && (
                    <>
                        <div className={cn('recent', { hasSuggestion: suggestions && suggestions.length > 0 })}>
                            <span>
                                최근 검색어
                            </span>
                        </div>
                        {props.history.map(item => (
                            <div key={item.pk} className={cn('history')}>
                                <span onClick={() => handleClickHistory(item.value)}>
                                    {item.value} <small className="shallow-dark">{item.createdDate}</small>
                                </span>
                                <span onClick={() => handleRemoveHistory(item.pk)}>
                                    <i className="fas fa-times" />
                                </span>
                            </div>
                        ))}
                    </>
                )}
            </div>
        </form>
    );
}
