import classNames from 'classnames/bind';
import styles from './SettingLayout.module.scss';
const cx = classNames.bind(styles);

import type { NAVIGATION_ITEMS } from '../setting-navigation';
import { SettingNavigation } from '../setting-navigation';

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
            <div className={cx('f')}>
                <div className={cx('f-1')}>
                    <div>
                        <div className={cx('c')}>
                            <SettingNavigation active={active} />
                            {sideChildren}
                        </div>
                    </div>
                </div>
                <div className={cx('f-2')}>
                    <div>
                        <div className={cx('c')}>
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
