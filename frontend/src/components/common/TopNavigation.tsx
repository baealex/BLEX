import React from 'react';
import Link from 'next/link';
import Router from 'next/router'

import { toast } from 'react-toastify';

import Cookie from '../../modules/cookie';
import API from '../../modules/api';
import Global from '../../modules/global';
import LoginModal from '../modal/Login';
import SettingModal from '../modal/Setting';

interface State {
    onNav: boolean;
    isNightMode: boolean;
    isLogin: boolean;
    username: string;
    search: string;
    isLoginModalOpen: boolean;
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
            isLoginModalOpen: false,
            isSettingModalOpen: false
        };
        Global.appendUpdater('TopNavigation', () => this.setState({
            ...this.state,
            isLogin: Global.state.isLogin,
            username: Global.state.username,
            isNightMode: Global.state.isNightMode
        }));
    }

    async componentDidMount(){
        const bodyClass = document.querySelector('body');
        const nightmode = Cookie.get('nightmode');
        nightmode === 'true' && bodyClass?.classList.add('dark');
        Global.setState({
            ...Global.state,
            isNightMode: nightmode ? true : false,
        });

        const alive = await API.alive();
        Global.setState({
            ...Global.state,
            isLogin: alive.data !== 'dead' ? true : false,
            username: alive.data !== 'dead' ? alive.data.username : '',
        });
        if(alive.data !== 'dead') {
            if(alive.data.notifyCount != 0) {
                toast(`😲 읽지 않은 알림이 ${alive.data.notifyCount}개 있습니다.`)
            }
        }

        Router.events.on('routeChangeStart', () => {
            this.onMouseLeaveOnContent();
        });
    }

    onClickNavigation() {
        this.setState({
            ...this.state,
            onNav: !this.state.onNav
        });
    }

    onOpenModal(modalName: string) {
        this.setState({
            ...this.state,
            [modalName]: true
        });
    }

    onCloseModal(modalName: string) {
        this.setState({
            ...this.state,
            [modalName]: false
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

    onMouseLeaveOnContent() {
        this.setState({
            ...this.state,
            onNav: false
        });
    }

    onClickNightMode() {
        const bodyClass = document.querySelector('body');
        if(this.state.isNightMode) {
            Cookie.set('nightmode', '', {
                path: '/',
                expire: -1,
            });
            Global.setState({
                ...Global.state,
                isNightMode: false
            });
            bodyClass?.classList.remove('dark');
        } else {
            Cookie.set('nightmode', 'true', {
                path: '/',
                expire: 365,
            });
            Global.setState({
                ...Global.state,
                isNightMode: true
            });
            bodyClass?.classList.add('dark');
        }
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
                    onClose={() => this.onCloseModal('isLoginModalOpen')}
                />
                <SettingModal
                    isOpen={this.state.isSettingModalOpen}
                    onClose={() => this.onCloseModal('isSettingModalOpen')}
                />
                <div
                    onMouseLeave={() => this.onMouseLeaveOnContent()}
                    className={`side-menu serif ${this.state.onNav ? 'on' : 'off' }`}>
                    <nav
                        onClick={() => this.onClickNavigation()}
                        className={`menu ${this.state.onNav ? 'on' : 'off' }`}>
                        <img src={this.state.onNav ? "/logor.png" : "/logo.png"}/>
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
                            <li>
                                <a onClick={() => this.onClickNightMode()}>
                                    <i className={`fas fa-${this.state.isNightMode ? 'sun' : 'moon'}`}></i>
                                </a>
                            </li>
                            {this.state.isLogin ? (
                                <>
                                    <li>
                                        <a onClick={() => this.onOpenModal('isSettingModalOpen')}>
                                            <i className="fas fa-cogs"></i>
                                        </a>
                                    </li>
                                    <li>
                                        <a onClick={() => this.onClickLogout()}>
                                            <i className="fas fa-sign-out-alt"></i> 로그아웃
                                        </a>
                                    </li>
                                </>
                            ) : (
                                <li>
                                    <a onClick={() => this.onOpenModal('isLoginModalOpen')}>
                                        <i className="fas fa-sign-in-alt"></i> 로그인
                                    </a>
                                </li>
                            )}
                        </ul>
                    </div>
                </div>
            </>
        )
    }
}

export default TopNavigation;