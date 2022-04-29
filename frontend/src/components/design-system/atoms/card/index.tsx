import classNames from 'classnames/bind';
import styles from './Card.module.scss';

const cn = classNames.bind(styles);

export interface CardProps {
    isRounded?: boolean;
    hasShadow?: boolean;
    shadowLevel?: 'main' | 'sub';
    fillBack?: boolean;
    children?: string | JSX.Element | JSX.Element[];
    className?: string;
}

export function Card(props: CardProps) {
    const {
        isRounded = false,
        hasShadow = false,
        shadowLevel = 'main',
        fillBack = false,
        className = '',
    } = props;

    return (
        <div className={cn(
            'card',
            {
                ir: isRounded 
            },
            {
                hs: hasShadow 
            },
            hasShadow && 'sl-' + shadowLevel,
            {
                fb: fillBack 
            },
            className,
        )}>
            {props.children}
        </div>
    );
}