import classNames from 'classnames/bind';
import styles from './WidgetLayout.module.scss';
const cx = classNames.bind(styles);

export interface WidgetLayoutProps {
    children: React.ReactNode;
    widget?: React.ReactNode;
    widgetPosition?: 'Left' | 'Right';
}

export const WidgetLayout: React.FC<WidgetLayoutProps> = ({ children, widget, widgetPosition = 'Right' }) => {
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
