import classNames from 'classnames/bind';
import styles from './SettingLayout.module.scss';
const cn = classNames.bind(styles);

import { SettingNavigation } from '../setting-navigation';

export interface SettingLayoutProps {
    active: string;
    sticky?: boolean;
    sideChildren?: JSX.Element | JSX.Element[];
    children: JSX.Element | JSX.Element[];
}

export function SettingLayout({
    active,
    sticky=true,
    sideChildren,
    children
}: SettingLayoutProps) {
    return (
        <>
            <div className={cn('f')}>
                <div className={cn('f-1')}>
                    <div>
                        <div className={cn('c')}>
                            <SettingNavigation
                                active={active}
                                sticky={sticky}
                            />
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
                    padding-top: 0px;
                }
            `}</style>
        </>
    );
}
