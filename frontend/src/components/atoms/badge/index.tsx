import styles from './Badge.module.scss';
import classNames from 'classnames/bind';
const cn = classNames.bind(styles);

interface BadgeProps {
    isRounded?: boolean;
    hasSharp?: boolean;
    isSolo?: boolean;
    size?: 'small' | 'normal';
    children: string | JSX.Element;
}

export function Badge(props: BadgeProps) {
    const {
        isRounded = false,
        hasSharp = false,
        isSolo = false,
        size = 'normal',
    } = props;

    return (
        <div className={cn(
            'badge',
            { ir: isRounded },
            { hs: hasSharp },
            { is: isSolo },
            size !== 'normal' && 'size-' + size
        )}>
            {props.children}
        </div>
    )
}