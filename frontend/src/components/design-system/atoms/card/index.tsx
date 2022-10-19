import classNames from 'classnames/bind';
import styles from './Card.module.scss';

const cn = classNames.bind(styles);

export interface CardProps {
    isRounded?: boolean;
    hasShadow?: boolean;
    shadowLevel?: 'main' | 'sub';
    hasBackground?: boolean;
    isNeumorphism?: boolean;
    backgroundType?: 'background' | 'card';
    neumorphismType?: 'flat' | 'concave' | 'convex';
    children?: React.ReactNode;
    className?: string;
}

export function Card({
    isRounded = false,
    hasShadow = false,
    shadowLevel = 'main',
    hasBackground = false,
    backgroundType = 'card',
    isNeumorphism = false,
    neumorphismType = 'flat',
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
                { in: isNeumorphism },
                (isNeumorphism && neumorphismType) && 'in-' + neumorphismType,
                className
            )}>
            {children}
        </div>
    );
}
