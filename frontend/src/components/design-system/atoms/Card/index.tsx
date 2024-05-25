import classNames from 'classnames/bind';
import styles from './Card.module.scss';

const cx = classNames.bind(styles);

export interface CardProps {
    isRounded?: boolean;
    hasShadow?: boolean;
    shadowLevel?: 'main' | 'sub';
    hasBackground?: boolean;
    backgroundType?: 'background' | 'card';
    children?: React.ReactNode;
    className?: string;
}

export function Card({
    isRounded = false,
    hasShadow = false,
    shadowLevel = 'main',
    hasBackground = false,
    backgroundType = 'card',
    className = '',
    children
}: CardProps) {
    return (
        <div
            className={cx(
                'card',
                { ir: isRounded },
                { hs: hasShadow },
                (hasShadow && shadowLevel) && 'sl-' + shadowLevel,
                { fb: hasBackground },
                (hasBackground && backgroundType) && 'fb-' + backgroundType,
                className
            )}>
            {children}
        </div>
    );
}
