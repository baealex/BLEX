import styles from './styles.module.scss';

import React, { useEffect } from 'react';

import { Button } from '@design-system';

interface Props {
    isOpen: boolean;
    title: string;
    onClose: Function;
    submitText?: string;
    onSubmit?: Function;
    children: string | JSX.Element | JSX.Element[];
    footer?: JSX.Element[];
}

export function Modal(props: Props) {
    useEffect(() => {
        if(props.isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }

        return () => {
            document.body.style.overflow = '';
        }
    }, [props.isOpen]);

    return (
        <>
            {props.isOpen && (
                <>
                    <div className={styles.overlay} onClick={() => props.onClose()}/>
                    <>
                        <div className={styles.modal}>
                            <div className={styles.headline}>
                                <div className={`font-weight-bold ${styles.title}`}>
                                    {props.title}
                                </div>
                                <div className={styles.close} onClick={() => props.onClose()}>
                                    <i className="fas fa-times"></i>
                                </div>
                            </div>
                            <div className={styles.content}>
                                {props.children}
                            </div>
                            {(props.submitText || props.footer) && (
                                <div className={styles.footer}>
                                    <div>
                                        {props.footer}
                                    </div>
                                    {props.submitText && (
                                        <Button
                                            space="spare"
                                            color="secondary"
                                            onClick={() => props.onSubmit && props.onSubmit()}>
                                            {props.submitText}
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                </>
            )}
        </>
    )
} 