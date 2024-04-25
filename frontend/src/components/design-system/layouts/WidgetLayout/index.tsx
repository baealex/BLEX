import styles from './WidgetLayout.module.scss';

export interface WidgetLayoutProps {
    children: React.ReactNode;
    widget?: React.ReactNode;
}

export const WidgetLayout: React.FC<WidgetLayoutProps> = ({ children, widget }) => {
    return (
        <div className={styles.layout}>
            <div className={styles.content}>
                {children}
            </div>
            {widget && (
                <aside className={styles.widgetContainer}>
                    <div className={styles.widget}>
                        {widget}
                    </div>
                </aside>
            )}
        </div>
    );
};
