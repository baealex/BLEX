import styles from './Dropdown.module.scss';
import classNames from 'classnames/bind';
const cn = classNames.bind(styles);

import {
    useEffect,
    useRef,
    useState,
} from 'react';

export interface DropdownProps {
    position?: 'left' | 'right';
    button: JSX.Element;
    menus: {
        icon?: string,
        name: string;
        onClick: (event: React.MouseEvent) => void;
        disable?: boolean;
    }[];
}

export function Dropdown(props: DropdownProps) {
    const {
        position = 'left'
    } = props;

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
                        <div className={cn('menu', position)}>
                            <ul>
                                {props.menus.map((menu, idx) => (
                                    <li key={idx} onClick={menu.onClick} className={cn({ disable: menu.disable })}>
                                        <a>
                                            <span>
                                                {menu.name}
                                            </span>
                                            {menu.icon && (
                                                <i className={menu.icon}/>
                                            )}
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