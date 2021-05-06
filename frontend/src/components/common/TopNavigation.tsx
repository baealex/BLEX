import React from 'react';
import Link from 'next/link';
import Router from 'next/router'

import { toast } from 'react-toastify';

import * as API from '@modules/api';
import Global from '@modules/global';
import Search from '@components/common/Search';
import LoginModal from '@components/modal/set/Login';
import SignupModal from '@components/modal/set/Signup';
import TwoFactorAuthModal from '@components/modal/set/TwoFactorAuth';

interface State {
    onNav: boolean;
    isNightMode: boolean;
    isLogin: boolean;
    username: string;
    isLoginModalOpen: boolean;
    isSignupModalOpen: boolean;
    isTwoFactorAuthModalOpen: boolean,
};

class TopNavigation extends React.Component {
    state: State;

    constructor(props: any) {
        super(props);
        this.state = {
            onNav: false,
            isNightMode: false,
            isLogin: Global.state.isLogin,
            username: Global.state.username,
            isLoginModalOpen: Global.state.isLoginModalOpen,
            isSignupModalOpen: Global.state.isSignupModalOpen,
            isTwoFactorAuthModalOpen: Global.state.isTwoFactorAuthModalOpen,
        };
        Global.appendUpdater('TopNavigation', () => this.setState({
            isLogin: Global.state.isLogin,
            username: Global.state.username,
            isNightMode: Global.state.isNightMode,
            isLoginModalOpen: Global.state.isLoginModalOpen,
            isSignupModalOpen: Global.state.isSignupModalOpen,
            isTwoFactorAuthModalOpen: Global.state.isTwoFactorAuthModalOpen,
        }));
    }

    async componentDidMount(){
        Global.configInit();
        if (Global.state.isFirstVisit) {
            const systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
            if(systemDark.matches) {
                document.body.classList.add('dark');
                Global.setState({
                    theme: 'dark',
                    isNightMode: true,
                });
            }
        } else {
            document.body.classList.add(Global.state.theme);
        }

        window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
            if (Global.state.theme === 'default' || Global.state.theme === 'dark')
            if(e.matches) {
                document.body.classList.add('dark');
                Global.setState({
                    theme: 'dark',
                    isNightMode: true,
                });
            } else {
                document.body.classList.remove('dark');
                Global.setState({
                    theme: 'default',
                    isNightMode: false,
                });
            }
        });

        const { data } = await API.getLogin();
        Global.setState({
            isLogin: data.status === 'DONE' ? true : false,
            username: data.status === 'DONE' ? data.body.username : '',
        });
        if(data.status === 'DONE') {
            if(data.body.notifyCount != 0) {
                toast(`😲 읽지 않은 알림이 ${data.body.notifyCount}개 있습니다.`, {
                    onClick:() => {
                        Router.push('/setting');
                    }
                });
            }
        }

        Router.events.on('routeChangeStart', () => {
            this.setState({
                onNav: false
            });
        });
    }

    onClickNightMode() {
        if (document.body.classList.contains('dark')) {
            document.body.classList.remove('dark');
            Global.setState({
                theme: 'default',
                isNightMode: false,
            });
        } else {
            document.body.classList.add('dark');
            Global.setState({
                theme: 'dark',
                isNightMode: true,
            });
        }
    }

    onClickNavigation() {
        this.setState({
            onNav: !this.state.onNav
        });
    }

    async onClickLogout() {
        if(confirm('😮 정말 로그아웃 하시겠습니까?')) {
            const { data } = await API.postLogout();
            if(data.status === 'DONE') {
                Global.setState({
                    isLogin: false,
                    username: ''
                });
                toast('😀 로그아웃 되었습니다.');
            }
        }
    }

    render() {
        return (
            <>
                <LoginModal
                    isOpen={this.state.isLoginModalOpen}
                    onClose={() => Global.onCloseModal('isLoginModalOpen')}
                />
                <SignupModal
                    isOpen={this.state.isSignupModalOpen}
                    onClose={() => Global.onCloseModal('isSignupModalOpen')}
                />
                <TwoFactorAuthModal
                    isOpen={this.state.isTwoFactorAuthModalOpen}
                    onClose={() => Global.onCloseModal('isTwoFactorAuthModalOpen')}
                />
                <div
                    className={`side-menu noto ${this.state.onNav ? 'on' : 'off' }`}>
                    <nav
                        onClick={() => this.onClickNavigation()}
                        className={`menu ${this.state.onNav ? 'on' : 'off' }`}>
                        <img src="/logo32.png" alt="logo"/>
                    </nav>
                    <div className="inner">
                        <Search/>
                        <ul className="menu-item">
                            <li>
                                <Link href="/">
                                    <a>인기 포스트</a>
                                </Link>
                            </li>
                            <li>
                                <Link href="/newest">
                                    <a>최신 포스트</a>
                                </Link>
                            </li>
                            <li>
                                <Link href="/tags">
                                    <a>태그 클라우드</a>
                                </Link>
                            </li>
                        </ul>
                        {this.state.isLogin ? (
                            <ul className="menu-item">
                                <li>
                                    <Link href={`/[author]`} as={`/@${this.state.username}`}>
                                        <a><i className="fas fa-user"></i> 내 블로그</a>
                                    </Link>
                                </li>
                                <li>
                                    <Link href="/write">
                                        <a><i className="fas fa-pencil-alt"></i> 포스트 작성</a>
                                    </Link>
                                </li>
                            </ul>
                        ) : (
                            <></>
                        )}
                        <ul className="menu-footer-item">
                            <li>
                                <a onClick={() => this.onClickNightMode()}>
                                    <i className={`fas fa-${this.state.isNightMode ? 'sun' : 'moon'}`}></i>
                                </a>
                            </li>
                            {this.state.isLogin ? (
                                <>
                                    <li>
                                        <Link href="/setting">
                                            <a><i className="fas fa-cogs"></i> 설정</a>
                                        </Link>
                                    </li>
                                    <li>
                                        <a onClick={() => this.onClickLogout()}>
                                            <i className="fas fa-sign-out-alt"></i> 로그아웃
                                        </a>
                                    </li>
                                </>
                            ) : (
                                <>
                                    <li>
                                        <a onClick={() => Global.onOpenModal('isLoginModalOpen')}>
                                            <i className="fas fa-sign-in-alt"></i> 로그인
                                        </a>
                                    </li>
                                    <li>
                                        <a onClick={() => Global.onOpenModal('isSignupModalOpen')}>
                                            <i className="fas fa-users"></i> 회원가입
                                        </a>
                                    </li>
                                </>
                            )}
                        </ul>
                    </div>
                </div>
            </>
        )
    }
}

export default TopNavigation;