import classNames from 'classnames/bind';
import styles from './Toggle.module.scss';
const cn = classNames.bind(styles);


import { useRef } from 'react';

export interface ToggleProps {
    label: string;
    onClick: (value: boolean) => void;
    defaultChecked?: boolean;
}

export function Toggle(props: ToggleProps) {
    const checkbox = useRef<HTMLInputElement>(null);

    return (
        <>
            <label className={cn('toggle')}>
                <input
                    type="checkbox"
                    ref={checkbox}
                    defaultChecked={props.defaultChecked}
                    onChange={(e) => props.onClick(e.target.checked)}
                />
                <span className={cn('switch')} />
                <span className={cn('label')}>{props.label}</span>
            </label>
        </>
    );
}
