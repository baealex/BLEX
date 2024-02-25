import styles from './Modal.module.scss';

import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

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
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleOpenModal = () => {
            const input = ref.current?.querySelector<HTMLInputElement>('input, textarea');

            input
                ? input.focus()
                : ref.current?.focus();
        };

        const handleKeyup = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            ref.current?.addEventListener('animationend', handleOpenModal);
            document.addEventListener('keyup', handleKeyup);
            document.body.style.overflow = 'hidden';
        } else {
            ref.current?.removeEventListener('animationend', handleOpenModal);
            document.removeEventListener('keyup', handleKeyup);
            document.body.style.overflow = '';
        }

        return () => {
            ref.current?.removeEventListener('animationend', handleOpenModal);
            document.removeEventListener('keyup', handleKeyup);
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    if (!isOpen) {
        return null;
    }

    return ReactDOM.createPortal(
        <>
            <div
                className={styles.overlay}
                onClick={onClose}
            />
            <div
                ref={ref}
                aria-modal="true"
                role="dialog"
                tabIndex={-1}
                className={`${styles.modal} ${styles[size]}`}>
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
        , document.body);
}
