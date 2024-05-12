import classNames from 'classnames/bind';
import styles from './SingleWidgetLayout.module.scss';
const cx = classNames.bind(styles);

export interface SingleWidgetLayoutProps {
    children: React.ReactNode;
    widget?: React.ReactNode;
    widgetPosition?: 'Left' | 'Right';
}

export const SingleWidgetLayout = ({
    children,
    widget,
    widgetPosition = 'Right'
}: SingleWidgetLayoutProps) => {
    return (
        <div className={styles.layout}>
            <div className={styles.content}>
                {children}
            </div>
            {widget && (
                <aside className={cx('widgetContainer', `widgetPosition${widgetPosition}`)}>
                    <div className={styles.widget}>
                        {widget}
                    </div>
                </aside>
            )}
        </div>
    );
};
