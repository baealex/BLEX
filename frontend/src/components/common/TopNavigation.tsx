import React from 'react';
import Link from 'next/link';
import Router from 'next/router'

import { toast } from 'react-toastify';

import API from '../../modules/api';
import Global from '../../modules/global';
import LoginModal from '../modal/Login';
import SignupModal from '../modal/Signup';
import SettingModal from '../modal/Setting';

interface State {
    onNav: boolean;
    isNightMode: boolean;
    isLogin: boolean;
    username: string;
    search: string;
    isLoginModalOpen: boolean;
    isSignupModalOpen: boolean;
    isSettingModalOpen: boolean;
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
            search: '',
            isLoginModalOpen: Global.state.isSettingModalOpen,
            isSignupModalOpen: Global.state.isSignupModalOpen,
            isSettingModalOpen: Global.state.isLoginModalOpen
        };
        Global.appendUpdater('TopNavigation', () => this.setState({
            ...this.state,
            isLogin: Global.state.isLogin,
            username: Global.state.username,
            isNightMode: Global.state.isNightMode,
            isLoginModalOpen: Global.state.isLoginModalOpen,
            isSignupModalOpen: Global.state.isSignupModalOpen,
            isSettingModalOpen: Global.state.isSettingModalOpen
        }));
    }

    async componentDidMount(){
        const bodyClass = document.querySelector('body');
        const darkModeCheck = '(prefers-color-scheme: dark)';
        const systemDark = window.matchMedia && window.matchMedia(darkModeCheck);
        systemDark.matches && bodyClass?.classList.add('dark');
        Global.setState({
            ...Global.state,
            isNightMode: systemDark.matches ? true : false,
        });

        window.matchMedia(darkModeCheck).addEventListener('change', e => {
            Global.setState({
                ...Global.state,
                isNightMode: e.matches,
            });
            if(e.matches) {
                bodyClass?.classList.add('dark');
            } else {
                bodyClass?.classList.remove('dark');
            }
        });

        const alive = await API.alive();
        Global.setState({
            ...Global.state,
            isLogin: alive.data !== 'dead' ? true : false,
            username: alive.data !== 'dead' ? alive.data.username : '',
        });
        if(alive.data !== 'dead') {
            if(alive.data.notifyCount != 0) {
                toast(`😲 읽지 않은 알림이 ${alive.data.notifyCount}개 있습니다.`, {
                    onClick:() => {
                        Global.onOpenModal('isSettingModalOpen');
                    }
                });
            }
        }

        Router.events.on('routeChangeStart', () => {
            this.setState({
                ...this.state,
                onNav: false
            });
        });
    }

    onClickNavigation() {
        this.setState({
            ...this.state,
            onNav: !this.state.onNav
        });
    }

    onEnterSearch(e: React.KeyboardEvent<HTMLInputElement>) {
        if(e.key == 'Enter') {
            window.open('about:blank')!.location.href = `https://google.com/search?q=${encodeURIComponent(`${this.state.search} site:blex.me`)}`;
        }
    }

    onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
        this.setState({
            ...this.state,
            [e.target.name]: e.target.value
        });
    }

    async onClickLogout() {
        if(confirm('😮 정말 로그아웃 하시겠습니까?')) {
            const { data } = await API.logout();
            if(data.status === 'success') {
                Global.setState({
                    ...Global.state,
                    isLogin: false,
                    username: ''
                });
                toast('😀 로그아웃 되었습니다.');
            }
        }
    }

    render() {
        const serachInput = (
            <input
                autoComplete="off"
                className="search"
                name="search"
                type="text"
                value={this.state.search}
                placeholder="Serach"
                onChange={(e) => this.onInputChange(e)}
                onKeyPress={(e) => this.onEnterSearch(e)}
            />
        );

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
                <SettingModal
                    isOpen={this.state.isSettingModalOpen}
                    onClose={() => Global.onCloseModal('isSettingModalOpen')}
                />
                <div
                    className={`side-menu serif ${this.state.onNav ? 'on' : 'off' }`}>
                    <nav
                        onClick={() => this.onClickNavigation()}
                        className={`menu ${this.state.onNav ? 'on' : 'off' }`}>
                        <img src="/logo.png" alt="logo"/>
                    </nav>
                    <div className="inner">
                        {serachInput}
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
                            {this.state.isLogin ? (
                                <>
                                    <li>
                                        <a onClick={() => Global.onOpenModal('isSettingModalOpen')}>
                                            <i className="fas fa-cogs"></i> 설정
                                        </a>
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