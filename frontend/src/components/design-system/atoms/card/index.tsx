import classNames from 'classnames/bind';
import styles from './Card.module.scss';

const cn = classNames.bind(styles);

export interface CardProps {
    isRounded?: boolean;
    hasShadow?: boolean;
    shadowLevel?: 'main' | 'sub';
    hasBackground?: boolean;
    backgroundType?: 'background' | 'card';
    children?: string | JSX.Element | JSX.Element[];
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
            className={cn(
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