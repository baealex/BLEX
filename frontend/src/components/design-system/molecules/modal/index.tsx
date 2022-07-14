import styles from './styles.module.scss';

import React, { useEffect } from 'react';

import { Button } from '@design-system';

interface Props {
    isOpen: boolean;
    title: string;
    footer?: React.ReactNode;
    children: React.ReactNode;
    submitText?: string;
    onClose: () => void;
    onSubmit?: () => void;
}

export function Modal({
    isOpen,
    title,
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

    return (
        <>
            {isOpen && (
                <>
                    <div
                        className={styles.overlay}
                        onClick={onClose}
                    />
                    <div className={styles.modal}>
                        <div className={styles.headline}>
                            <div className={`font-weight-bold ${styles.title}`}>
                                {title}
                            </div>
                            <div className={styles.close} onClick={() => onClose()}>
                                <i className="fas fa-times"></i>
                            </div>
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
            )}
        </>
    );
}