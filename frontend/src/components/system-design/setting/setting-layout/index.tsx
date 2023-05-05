import classNames from 'classnames/bind';
import styles from './SettingLayout.module.scss';
const cn = classNames.bind(styles);

import { NAVIGATION_ITEMS, SettingNavigation } from '../setting-navigation';

export interface SettingLayoutProps {
    active: typeof NAVIGATION_ITEMS[number]['subItems'][number]['name'];
    sideChildren?: JSX.Element | JSX.Element[];
    children: JSX.Element | JSX.Element[];
}

export function SettingLayout({
    active,
    sideChildren,
    children
}: SettingLayoutProps) {
    return (
        <>
            <div className={cn('f')}>
                <div className={cn('f-1')}>
                    <div>
                        <div className={cn('c')}>
                            <SettingNavigation active={active} />
                            {sideChildren}
                        </div>
                    </div>
                </div>
                <div className={cn('f-2')}>
                    <div>
                        <div className={cn('c')}>
                            {children}
                        </div>
                    </div>
                </div>
            </div>
            <style jsx>{`
                :global(.content) {
                    padding-top: 0px !important;
                }
            `}</style>
        </>
    );
}
