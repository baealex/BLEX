import styles from './styles.module.scss';

import React from 'react';

interface Props {
    children: JSX.Element | JSX.Element[];
}

export default function Content(props: Props) {
    return (
        <>
            <div className={`noto ${styles.content}`}>
                {props.children}
            </div>
        </>
    )
}