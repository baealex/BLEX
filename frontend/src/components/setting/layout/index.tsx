import { Navigation } from '@components/setting/navigation';
import { Footer } from '@components/shared';

export interface LayoutProps {
    tabname: string;
    sticky?: boolean
    sideChildren?: JSX.Element | JSX.Element[];
    children: JSX.Element | JSX.Element[];
}

export function Layout({
    tabname,
    sticky=true,
    sideChildren,
    children
}: LayoutProps) {
    return (
        <>
            <div className="container">
                <div className="row">
                    <div className="col-lg-3">
                        <Navigation tabname={tabname} sticky={sticky}/>
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