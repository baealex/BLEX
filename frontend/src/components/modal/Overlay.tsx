import styles from './styles.module.scss';

import React from 'react';

interface Props {
    onClick: Function;
}

export default function Overlay(props: Props) {
    return (
        <>
            <div className={styles.overlay} onClick={() => props.onClick()}/>
        </>
    )
}