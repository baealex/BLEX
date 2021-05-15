import styles from './Accordian.module.scss';
import classNames from 'classnames';

import { useEffect, useRef, useState } from 'react';

export interface ArcodianProps {
    minHeight?: number;
    children?: JSX.Element | JSX.Element[];
}

export function Accordian(props: ArcodianProps) {
    const {
        minHeight = 130
    } = props;

    const [isOpen, setIsOpen] = useState(false);
    const [maxHeight, setMaxHeight] = useState(0);
    const divRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (divRef.current) {
            setMaxHeight(divRef.current.clientHeight + 30);
        }
    }, [divRef]);

    return (
        <>
            <div
                className={styles.accordian}
                style={{
                    height: isOpen 
                        ? `${maxHeight}px`
                        : `${maxHeight < minHeight ? maxHeight : minHeight}px`
                }}
            >
                <div ref={divRef}>
                    {props.children}
                </div>
                <button onClick={() => setIsOpen(!isOpen)}>
                    <i className={classNames(
                        'fas fa-chevron-up',
                        isOpen && styles.isOpen
                    )}></i>
                </button>
            </div>
        </>
    );
}