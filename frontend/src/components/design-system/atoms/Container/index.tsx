import styles from './Container.module.scss';

interface Container {
    size?: 'xs' | 'xs-sm' | 'sm' | 'md' | 'lg' | 'xl';
    children: React.ReactNode;
}

export function Container({
    children,
    size = 'lg'
}: Container) {
    return (
        <div className={`${styles.container} ${styles[`size-${size}`]}`}>
            {children}
        </div>
    );
}
