import styles from './Card.module.scss';
import classNames from 'classnames/bind';

const cn = classNames.bind(styles);

export interface CardProps {
    isRounded?: boolean;
    children?: string | JSX.Element | JSX.Element[];
    className?: string;
}

export function Card(props: CardProps) {
    const {
        isRounded = false,
        className = '',
    } = props;

    return (
        <div className={cn(
            'card',
            { isRounded },
            className,
        )}>
            {props.children}
        </div>
    )
}