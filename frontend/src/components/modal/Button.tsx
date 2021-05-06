import styles from './styles.module.scss';

import React from 'react';

interface Props {
    text: string;
    onClick: Function;
}

export default function Button(props: Props) {
    return (
        <>
            <div className={styles.button} onClick={() => props.onClick()}>
                <button>{props.text}</button>
            </div>
        </>
    )
}