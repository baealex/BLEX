import { PageNavigation } from '~/components/design-system';
import type { PageNavigationProps } from '~/components/design-system';

import styles from './PageNavigationLayout.module.scss';

export interface PageNavigationLayoutProps {
    navigationItems: PageNavigationProps['items'];
    navigationActive: PageNavigationProps['active'];
    children: React.ReactNode;
}

export function PageNavigationLayout({ navigationActive, navigationItems, children }: PageNavigationLayoutProps) {
    return (
        <div className={styles.layout}>
            <PageNavigation
                items={navigationItems}
                active={navigationActive}
            />
            <div>
                {children}
            </div>
        </div>
    );
}
