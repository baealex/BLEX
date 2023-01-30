import styles from './Modal.module.scss';

import React, { useEffect } from 'react';

import { Button } from '@design-system';

interface Props {
    isOpen: boolean;
    title: string;
    size?: 'small' | 'medium' | 'large';
    footer?: React.ReactNode;
    children: React.ReactNode;
    submitText?: string;
    onClose: () => void;
    onSubmit?: () => void;
}

export function Modal({
    isOpen,
    title,
    size='small',
    footer,
    children,
    submitText,
    onClose,
    onSubmit
}: Props) {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }

        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    if (!isOpen) {
        return null;
    }

    return (
        <>
            <div
                className={styles.overlay}
                onClick={onClose}
            />
            <div className={`${styles.modal} ${styles[size]}`}>
                <div className={styles.headline}>
                    <div className={`${styles.title}`}>
                        {title}
                    </div>
                    <button className={styles.close} onClick={onClose}>
                        <i className="fas fa-times"></i>
                    </button>
                </div>
                <div className={styles.content}>
                    {children}
                </div>
                {(submitText || footer) && (
                    <div className={styles.footer}>
                        <div>
                            {footer}
                        </div>
                        {submitText && (
                            <Button
                                space="spare"
                                color="secondary"
                                onClick={onSubmit}>
                                {submitText}
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </>
    );
}
