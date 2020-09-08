import React from 'react'
import Link from 'next/link'

import Cookie from '../../modules/cookie'
import API from '../../modules/api';

class TopNavigation extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            onNav: false,
            isLogin: false,
            username: '',
            isNightMode: false
        };
    }

    async componentDidMount(){
        this.bodyClass = document.querySelector('body').classList;
        const alive = await API.alive();
        const nightmode = Cookie.get('nightmode');
        nightmode === 'true' && this.bodyClass.add('dark');
        this.setState({
            ...this.state,
            isLogin: alive.data !== 'dead' ? true : false,
            username: alive.data !== 'dead' ? alive.data : '',
            isNightMode: nightmode ? true : false,
        });
    }

    onClickNavigation() {
        let newState = this.state;
        newState.onNav = !newState.onNav;
        this.setState(newState);
    }

    onMouseLeaveOnContent() {
        let newState = this.state;
        newState.onNav = false;
        this.setState(newState);
    }

    onClickNightMode() {
        if(this.state.isNightMode) {
            Cookie.set('nightmode', '', {
                path: '/',
                expire: -1,
            });
            this.setState({
                ...this.state,
                isNightMode: false
            });
            this.bodyClass.remove('dark');
        } else {
            Cookie.set('nightmode', 'true', {
                path: '/',
                expire: 365,
            });
            this.setState({
                ...this.state,
                isNightMode: true
            });
            this.bodyClass.add('dark');
        }
    }

    async onClickLogout() {
        const { data } = await API.logout();
        if(data.logout === 'success') {
            this.setState({
                ...this.state,
                isLogin: false
            });
        }
    }

    render() {
        return (
            <>
                <div
                    onMouseLeave={() => this.onMouseLeaveOnContent()}
                    className={`side-menu serif ${this.state.onNav ? 'on' : 'off' }`}>
                    <nav
                        onClick={() => this.onClickNavigation()}
                        className={`menu ${this.state.onNav ? 'on' : 'off' }`}>
                        <img src="https://static.blex.me/assets/images/logo.png"/>
                    </nav>
                    <div className="inner">
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
                                    <Link href="/">
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
                                <li>
                                    <a onClick={() => this.onClickLogout()}>
                                        <i className="fas fa-sign-out-alt"></i> 로그아웃
                                    </a>
                                </li>
                            ) : (
                                <li>
                                    <Link href="/login">
                                        <a>
                                            <i className="fas fa-sign-in-alt"></i> 로그인
                                        </a>
                                    </Link>
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