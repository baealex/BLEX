import classNames from 'classnames/bind';
import styles from './Badge.module.scss';
const cn = classNames.bind(styles);

interface BadgeProps {
    isRounded?: boolean;
    hasSharp?: boolean;
    isSolo?: boolean;
    size?: 'small' | 'normal';
    children: React.ReactNode;
}

export function Badge({
    isRounded = false,
    hasSharp = false,
    isSolo = false,
    size = 'normal',
    children,
}: BadgeProps) {
    return (
        <div className={cn(
            'badge',
            {
                ir: isRounded 
            },
            {
                hs: hasSharp 
            },
            {
                is: isSolo 
            },
            size !== 'normal' && 'size-' + size
        )}>
            {children}
        </div>
    );
}