import React from 'react';
import Link from 'next/link';

import { toast } from 'react-toastify';

import Cookie from '../../modules/cookie';
import API from '../../modules/api';
import Global from '../../modules/global';
import LoginModal from '../modal/Login';
import SettingModal from '../modal/Setting';

class TopNavigation extends React.Component {
    constructor(props) {
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
        this.bodyClass = document.querySelector('body').classList;
        const nightmode = Cookie.get('nightmode');
        nightmode === 'true' && this.bodyClass.add('dark');
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
            if(alive.data.notify_count != 0) {
                toast(`😲 읽지 않은 알림이 ${alive.data.notify_count}개 있습니다.`)
            }
        }
    }

    onClickNavigation() {
        this.setState({
            ...this.state,
            onNav: !this.state.onNav
        });
    }

    onOpenModal(modalName) {
        let newState = this.state;
        newState[modalName] = true;
        this.setState(newState);
    }

    onCloseModal(modalName) {
        let newState = this.state
        newState[modalName] = false
        this.setState(newState);
    }

    onEnterSearch(e) {
        if(e.key == 'Enter') {
            window.open('about:blank').location.href = `https://duckduckgo.com/?q=${encodeURIComponent(`${this.state.search} site:blex.me`)}`;
        }
    }

    onInputChange(e) {
        let newState = this.state;
        newState[e.target.name] = e.target.value;
        this.setState(newState);
    }

    onMouseLeaveOnContent() {
        this.setState({
            ...this.state,
            onNav: false
        });
    }

    onClickNightMode() {
        if(this.state.isNightMode) {
            Cookie.set('nightmode', '', {
                path: '/',
                expire: -1,
            });
            Global.setState({
                ...Global.state,
                isNightMode: false
            });
            this.bodyClass.remove('dark');
        } else {
            Cookie.set('nightmode', 'true', {
                path: '/',
                expire: 365,
            });
            Global.setState({
                ...Global.state,
                isNightMode: true
            });
            this.bodyClass.add('dark');
        }
    }

    async onClickLogout() {
        if(confirm('정말 로그아웃 하시겠습니까?')) {
            const { data } = await API.logout();
            if(data.status === 'success') {
                Global.setState({
                    ...Global.state,
                    isLogin: false
                });
                toast('😥 로그아웃 되었습니다.');
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
                <LoginModal isOpen={this.state.isLoginModalOpen} onClose={() => this.onCloseModal('isLoginModalOpen')}/>
                <SettingModal isOpen={this.state.isSettingModalOpen} onClose={() => this.onCloseModal('isSettingModalOpen')}/>
                <div
                    onMouseLeave={() => this.onMouseLeaveOnContent()}
                    className={`side-menu serif ${this.state.onNav ? 'on' : 'off' }`}>
                    <nav
                        onClick={() => this.onClickNavigation()}
                        className={`menu ${this.state.onNav ? 'on' : 'off' }`}>
                        <img src="https://static.blex.me/assets/images/logo.png"/>
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
                                    <Link href="#">
                                        <a onClick={() => toast('😥 준비중입니다...')}><i className="fas fa-pencil-alt"></i> 포스트 작성</a>
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