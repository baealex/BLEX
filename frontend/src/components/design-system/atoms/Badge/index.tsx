import classNames from 'classnames/bind';
import styles from './Badge.module.scss';
const cx = classNames.bind(styles);

interface BadgeProps {
    isRounded?: boolean;
    hasHash?: boolean;
    size?: 'small' | 'medium';
    className?: string;
    onClick?: () => void;
    children: React.ReactNode;
    style?: React.CSSProperties;
}

export function Badge({
    isRounded = false,
    hasHash = false,
    size = 'medium',
    className,
    onClick,
    children,
    style
}: BadgeProps) {
    return (
        <div
            onClick={onClick}
            style={style}
            className={cx(
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
