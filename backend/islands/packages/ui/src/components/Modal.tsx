import type {
    ButtonHTMLAttributes,
    ComponentProps,
    HTMLAttributes,
    ReactNode
} from 'react';
import { X } from 'lucide-react';
import { Dialog } from './Dialog';
import Button from './Button';
import { cx } from '../lib/classnames';
import { DIM_OVERLAY_DEFAULT, INTERACTION_DURATION } from '../lib/designTokens';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: ReactNode;
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
    showCloseButton?: boolean;
}

interface ModalSectionProps extends HTMLAttributes<HTMLDivElement> {
    children: ReactNode;
}

type ModalTitleProps = ComponentProps<typeof Dialog.Title>;

interface ModalCloseButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    ariaLabel?: string;
    iconClassName?: string;
}

type ModalFooterActionProps = Omit<ComponentProps<typeof Button>, 'size'> & {
    size?: ComponentProps<typeof Button>['size'];
};

const ModalHeader = ({ children, className = '', ...props }: ModalSectionProps) => (
    <div
        className={cx(
            'flex items-center justify-between gap-3 px-6 py-5 border-b border-line sticky top-0 bg-surface-elevated z-10',
            className
        )}
        {...props}>
        {children}
    </div>
);

const ModalTitle = ({ className = '', ...props }: ModalTitleProps) => (
    <Dialog.Title className={cx('text-xl font-bold text-content', className)} {...props} />
);

const ModalBody = ({ children, className = '', ...props }: ModalSectionProps) => (
    <div className={cx('p-6', className)} {...props}>
        {children}
    </div>
);

const ModalFooter = ({ children, className = '', ...props }: ModalSectionProps) => (
    <div
        className={cx(
            'flex items-center justify-end gap-3 px-6 py-4 border-t border-line bg-surface-subtle',
            className
        )}
        {...props}>
        {children}
    </div>
);

const ModalCloseButton = ({
    ariaLabel = 'Close',
    iconClassName = '',
    className = '',
    ...props
}: ModalCloseButtonProps) => (
    <Dialog.Close asChild>
        <button
            className={cx(
                'text-content-hint hover:text-content-secondary transition-colors p-2 hover:bg-surface-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-action/20',
                className
            )}
            aria-label={ariaLabel}
            {...props}>
            <X className={cx('w-6 h-6', iconClassName)} />
        </button>
    </Dialog.Close>
);

const ModalFooterAction = ({
    size = 'md',
    className = '',
    ...props
}: ModalFooterActionProps) => (
    <Button
        size={size}
        className={cx('min-w-[88px]', className)}
        {...props}
    />
);

const ModalRoot = ({
    isOpen,
    onClose,
    title,
    children,
    maxWidth = '2xl',
    showCloseButton = true
}: ModalProps) => {
    // Use explicit class names for Tailwind to detect at build time
    const getMaxWidthClass = () => {
        switch (maxWidth) {
            case 'sm': return 'sm:max-w-sm';
            case 'md': return 'sm:max-w-md';
            case 'lg': return 'sm:max-w-lg';
            case 'xl': return 'sm:max-w-xl';
            case '2xl': return 'sm:max-w-2xl';
            case '3xl': return 'sm:max-w-3xl';
            case '4xl': return 'sm:max-w-4xl';
            default: return 'sm:max-w-2xl';
        }
    };

    return (
        <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <Dialog.Portal>
                {/* 블러 백드롭 */}
                <Dialog.Overlay
                    className={cx(
                        `fixed inset-0 ${DIM_OVERLAY_DEFAULT} z-[60] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0`
                    )}
                />

                <Dialog.Content
                    className={cx(
                        // Base styles
                        `fixed z-[61] bg-surface-elevated shadow-2xl ${INTERACTION_DURATION} focus:outline-none flex flex-col`,
                        'max-h-[85vh] overflow-y-auto',

                        // Animations
                        'data-[state=open]:animate-in data-[state=closed]:animate-out',
                        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',

                        // Mobile: Bottom Sheet
                        'bottom-0 left-0 w-full',
                        'translate-x-0 translate-y-0',
                        'rounded-t-2xl rounded-b-none',
                        'data-[state=closed]:slide-out-to-bottom hover:data-[state=closed]:slide-out-to-bottom',
                        'data-[state=open]:slide-in-from-bottom',

                        // Desktop: Centered Modal
                        'sm:top-[50%] sm:left-[50%] sm:bottom-auto',
                        'sm:w-full',
                        getMaxWidthClass(),
                        'sm:translate-x-[-50%] sm:translate-y-[-50%]',
                        'sm:rounded-2xl',
                        'sm:data-[state=closed]:slide-out-to-bottom-[48%]',
                        'sm:data-[state=open]:slide-in-from-bottom-[48%]'
                    )}>

                    {/* 헤더 */}
                    {(title || showCloseButton) && (
                        <ModalHeader>
                            {title && (
                                <ModalTitle>{title}</ModalTitle>
                            )}
                            {showCloseButton && (
                                <ModalCloseButton className={!title ? 'ml-auto' : ''} />
                            )}
                        </ModalHeader>
                    )}

                    {/* 컨텐츠 */}
                    <div className="p-0">
                        {children}
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};

interface ModalCompoundComponent {
    (props: ModalProps): ReactNode;
    Header: typeof ModalHeader;
    Title: typeof ModalTitle;
    Body: typeof ModalBody;
    Footer: typeof ModalFooter;
    CloseButton: typeof ModalCloseButton;
    FooterAction: typeof ModalFooterAction;
}

const Modal = Object.assign(ModalRoot, {
    Header: ModalHeader,
    Title: ModalTitle,
    Body: ModalBody,
    Footer: ModalFooter,
    CloseButton: ModalCloseButton,
    FooterAction: ModalFooterAction
}) as ModalCompoundComponent;

export default Modal;
