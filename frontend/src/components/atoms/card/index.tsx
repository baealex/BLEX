import styles from './Card.module.scss';
import classNames from 'classnames/bind';

const cn = classNames.bind(styles);

export interface CardProps {
    isRounded?: boolean;
    children?: JSX.Element | JSX.Element[];
}

export function Card(props: CardProps) {
    const {
        isRounded = false,
    } = props;

    return (
        <div className={cn(
            'card',
            { isRounded }
        )}>
            {props.children}
        </div>
    )
}