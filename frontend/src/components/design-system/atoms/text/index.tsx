import classNames from 'classnames/bind';
import styles from './Text.module.scss';
const cn = classNames.bind(styles);

export interface TextProps {
    children: React.ReactNode;
    className?: string;
    fontSize?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
    fontWeight?: 100 | 200 | 300 | 400 | 500 | 600 | 700;
}

export function Text(props: TextProps) {
    const {
        fontSize = 4,
        fontWeight = 400
    } = props;
    return (
        <>
            <div
                className={cn(
                    'text',
                    `fs-${fontSize}`,
                    fontWeight !== 400 && `fw-${fontWeight / 100}`,
                    props.className
                )}>
                {props.children}
            </div>
        </>
    );
}
