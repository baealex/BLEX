import SideNavigation from '@components/setting/navigation';
import {
    Footer
} from '@components/shared';

interface Props {
    tabname: string;
    sticky?: boolean
    sideChildren?: JSX.Element | JSX.Element[];
    children: JSX.Element | JSX.Element[];
}

export default function SettingLayout({
    tabname,
    sticky=true,
    sideChildren,
    children
}: Props) {
    return (
        <>
            <div className="container noto">
                <div className="row">
                    <div className="col-lg-3">
                        <SideNavigation tabname={tabname} sticky={sticky}/>
                        {sideChildren}
                    </div>
                    <div className="col-lg-8">
                        {children}
                        <Footer />
                    </div>
                </div>
            </div>
        </>
    );
}