import classNames from 'classnames/bind';
import styles from './Badge.module.scss';
const cn = classNames.bind(styles);

interface BadgeProps {
    isRounded?: boolean;
    hasHash?: boolean;
    size?: 'small' | 'medium';
    className?: string;
    onClick?: () => void;
    children: React.ReactNode;
}

export function Badge({
    isRounded = false,
    hasHash = false,
    size = 'medium',
    className,
    onClick,
    children
}: BadgeProps) {
    return (
        <div
            onClick={onClick}
            className={cn(
                'badge',
                { ir: isRounded },
                { hs: hasHash },
                { clickable: !!onClick },
                size !== 'medium' && 'size-' + size,
                className
            )}>
            {children}
        </div>
    );
}