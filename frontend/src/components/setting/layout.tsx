import SideNavigation from '@components/setting/navigation';

interface Props {
    tabname: string;
    children: JSX.Element | JSX.Element[];
}

export default function SettingLayout(props: Props) {
    return (
        <>
            <div className="container">
                <div className="row">
                    <div className="col-lg-3">
                        <SideNavigation tabname={props.tabname}/>
                    </div>
                    <div className="col-lg-8 noto">
                        {props.children}
                    </div>
                </div>
            </div>
        </>
    );
}