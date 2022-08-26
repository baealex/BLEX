import classNames from 'classnames/bind';
import styles from './ImagePreload.module.scss';
const cn = classNames.bind(styles);

interface ImagePreloadProps {
    links: string[];
}

export function ImagePreload({ links }: ImagePreloadProps) {
    return (
        <div className={cn('preload')}>
            {links.map((link, idx) => (
                <img key={idx} src={link} />
            ))}
        </div>
    );
}
