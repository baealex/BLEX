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
            <div className="f">
                <div className="f-1">
                    <div>
                        <div className="c">
                            <SettingNavigation
                                active={active}
                                sticky={sticky}
                            />
                            {sideChildren}
                        </div>
                    </div>
                </div>
                <div className="f-2">
                    <div>
                        <div className="c">
                            {children}
                        </div>
                    </div>
                </div>
            </div>
            <style jsx>{`
                :global(.content) {
                    padding-top: 0px;
                }

                .f {
                    position: absolute;
                    display: flex;
                    height: 100%;
                    width: 100%;
                    top: 0;
                    left: 0;
                }

                .f-1,
                .f-2 {
                    display: flex;
                    max-width: 100%;
                    overflow-y: auto;

                    & .c {
                        padding-top: 100px;
                        padding-bottom: 40px;
                    }
                }

                .f-1 {
                    flex: 1 0 218px;
                    justify-content: flex-end;
                    background: #F5F5F8;

                    :global(body.dark) & {
                        background: #2A2A2A;
                    }

                    & > div {
                        margin: 0 8px;
                        width: 218px - 16px;
                    }
                }

                .f-2 {
                    flex: 1 1 720px;
                    justify-content: flex-start;

                    & > div {
                        margin-left: 24px;
                        margin-right: 16px;
                        width: 720px - (24px + 16px);
                    }
                }

                @media (max-width: 980px) {
                    .f-2 {
                        flex: 1 1 560px;
    
                        & > div {
                            width: 560px - (24px + 16px);
                        }
                    }
                }

                @media (max-width: 860px) {
                    .f-2 {
                        flex: 1 1 540px;
    
                        & > div {
                            width: 540px - (24px + 16px);
                        }
                    }
                }

                @media (max-width: 768px) {
                    .f {
                        flex-direction: column;
                        position: relative;
                    }

                    .f-1 {
                        & .c {
                            padding-bottom: 0;
                        }
                    }

                    .f-2 {
                        & > div {
                            margin-left: 0px;
                            margin-right: 0px;
                        }

                        & .c {
                            padding-top: 32px;
                        }
                    }

                    .f-1, .f-2 {
                        justify-content: flex-start;
                        overflow-y: inherit;

                        & > div {
                            width: 100%;
                        }

                        & .c {
                            margin: 0 16px;
                        }
                    }
                }
            `}</style>
        </>
    );
}