import styles from './TagBadge.module.scss';
import classNames from 'classnames/bind';
const cn = classNames.bind(styles);

export interface TagBadgeProps {
    items: any[];
    disableSharp: boolean;
}

export function TagBadge(props: TagBadgeProps) {
    return (
        <ul className={classNames(cn('items', { disableSharp: props.disableSharp }))}>
            {props.items.map((item, idx) => (
                item && (
                    <li key={idx}>
                        {item}
                    </li>
                )
            ))}
        </ul>
    );
}