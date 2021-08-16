import styles from './Card.module.scss';
import classNames from 'classnames/bind';

const cn = classNames.bind(styles);

export interface CardProps {
    isRounded?: boolean;
    hasShadow?: boolean;
    children?: string | JSX.Element | JSX.Element[];
    className?: string;
}

export function Card(props: CardProps) {
    const {
        isRounded = false,
        hasShadow = false,
        className = '',
    } = props;

    return (
        <div className={cn(
            'card',
            { isRounded },
            { hasShadow },
            className,
        )}>
            {props.children}
        </div>
    )
}