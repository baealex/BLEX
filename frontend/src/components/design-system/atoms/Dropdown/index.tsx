import classNames from 'classnames/bind';
import styles from './Dropdown.module.scss';
const cx = classNames.bind(styles);

import {
    useEffect,
    useRef,
    useState
} from 'react';

export interface DropdownProps {
    position?: 'left' | 'right';
    button: React.ReactNode;
    menus: {
        icon?: string;
        name: string;
        onClick: (event: React.MouseEvent) => void;
        disable?: boolean;
    }[];
}

export function Dropdown(props: DropdownProps) {
    const { position = 'left' } = props;

    const box = useRef<HTMLDivElement>(null);
    const toggle = useRef<HTMLButtonElement>(null);

    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            const path = e.composedPath && e.composedPath();

            if (
                box.current && !path.includes(box.current) &&
                toggle.current && !path.includes(toggle.current)
            ) {
                setIsOpen(false);
            }
        };

        document.addEventListener('click', handleClick);
        return () => {
            document.removeEventListener('click', handleClick);
        };
    }, []);

    return (
        <div
            role="button"
            aria-label="dropdown"
            onClick={() => setIsOpen((prevIsOpen) => !prevIsOpen)}>
            <button ref={toggle} aria-label="toggle" className={cx('button')}>
                {props.button}
            </button>
            <div className={cx('box')} ref={box}>
                {isOpen && (
                    <div className={cx('menu', position)}>
                        <ul>
                            {props.menus.map((menu, idx) => (
                                <li
                                    key={idx}
                                    onClick={menu.onClick}
                                    className={cx({ disable: menu.disable })}>
                                    <span>
                                        {menu.name}
                                    </span>
                                    {menu.icon && (
                                        <i className={menu.icon}/>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
}
