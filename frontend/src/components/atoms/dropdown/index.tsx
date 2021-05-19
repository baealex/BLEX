import styles from './Dropdown.module.scss';
import classNames from 'classnames/bind';
const cn = classNames.bind(styles);

import { useState } from 'react';

export interface DropdownProps {
    button: JSX.Element;
    menus: {
        name: string;
        onClick: (event: React.MouseEvent) => void;
    }[];
}

export function Dropdown(props: DropdownProps) {
    const [ isOpen, setIsOpen ] = useState(false);
    return (
        <>
            <div onClick={() => setIsOpen(!isOpen)}>
                <span className={cn('button')}>
                    {props.button}
                </span>
                <div className={cn(
                    'menu',
                    { isOpen }
                )}>
                    <ul>
                        {props.menus.map((menu, idx) => (
                            <li key={idx} onClick={menu.onClick}>
                                <a>
                                    {menu.name}
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </>
    )
}