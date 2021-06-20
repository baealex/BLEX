import styles from './Dropdown.module.scss';
import classNames from 'classnames/bind';
const cn = classNames.bind(styles);

import {
    useEffect,
    useRef,
    useState,
} from 'react';

export interface DropdownProps {
    button: JSX.Element;
    menus: {
        name: string;
        onClick: (event: React.MouseEvent) => void;
    }[];
}

export function Dropdown(props: DropdownProps) {
    const box = useRef<HTMLDivElement>(null);
    const toggle = useRef<HTMLSpanElement>(null);

    const [ isOpen, setIsOpen ] = useState(false);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            const path = e.composedPath && e.composedPath();

            if (
                !path.includes(box.current as EventTarget) &&
                !path.includes(toggle.current as EventTarget)
            ) {
                setIsOpen(false);
            }
        };

        document.addEventListener('click', handleClick);
        return () => {
            document.removeEventListener('click', handleClick);
        }
    }, []);

    return (
        <>
            <div onClick={() => setIsOpen((prevIsOpen) => !prevIsOpen)}>
                <span ref={toggle} className={cn('button')}>
                    {props.button}
                </span>
                <div ref={box}>
                    {isOpen && (
                        <div className={cn('menu')}>
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
                    )}
                </div>
            </div>
        </>
    )
}