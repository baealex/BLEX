import { SettingNavigation } from '../setting-navigation';

export interface SettingLayoutProps {
    active: string;
    sticky?: boolean
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
            <div className="container">
                <div className="row">
                    <div className="col-lg-3">
                        <SettingNavigation
                            active={active}
                            sticky={sticky}
                        />
                        {sideChildren}
                    </div>
                    <div className="col-lg-8">
                        {children}
                    </div>
                </div>
            </div>
        </>
    );
}