import classNames from 'classnames/bind';
import styles from './Badge.module.scss';
const cn = classNames.bind(styles);

interface BadgeProps {
    isRounded?: boolean;
    hasHash?: boolean;
    size?: 'small' | 'medium';
    className?: string;
    children: React.ReactNode;
}

export function Badge({
    isRounded = false,
    hasHash = false,
    size = 'medium',
    className,
    children
}: BadgeProps) {
    return (
        <div
            className={cn(
                'badge',
                { ir: isRounded },
                { hs: hasHash },
                size !== 'medium' && 'size-' + size,
                className
            )}>
            {children}
        </div>
    );
}