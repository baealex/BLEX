import styles from './styles.module.scss';

import React, { useEffect } from 'react';

interface Props {
    isOpen: boolean;
    title: string;
    onClose: Function;
    submitText?: string;
    onSubmit?: Function;
    children: string | JSX.Element | JSX.Element[];
}

export function Modal(props: Props) {
    useEffect(() => {
        if(props.isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'initial';
        }

        return () => {
            document.body.style.overflow = 'initial';
        }
    }, [props.isOpen]);

    return (
        <>
            {props.isOpen && (
                <>
                    <div className={styles.overlay} onClick={() => props.onClose()}/>
                    <>
                        <div className={styles.modal}>
                            <div className={`noto font-weight-bold ${styles.title}`}>
                                {props.title}
                            </div>
                            <div className={styles.close} onClick={() => props.onClose()}>
                                <i className="fas fa-times"></i>
                            </div>
                            <div className={`noto ${styles.content}`}>
                                {props.children}
                            </div>
                            {props.submitText && (
                                <div className={styles.button} onClick={() => props.onSubmit && props.onSubmit()}>
                                    <button>{props.submitText}</button>
                                </div>
                            )}
                        </div>
                    </>
                </>
            )}
        </>
    )
} 