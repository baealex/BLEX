import React from 'react'
import Link from 'next/link'

import Cookie from '../../modules/cookie'

class TopNavigation extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            onNav: false,
        };
    }

    componentDidMount(){
        this.bodyClass = document.querySelector('body').classList;
        const key = Cookie.get('key');
        const nightmode = Cookie.get('nightmode');
        nightmode === 'true' && this.bodyClass.add('dark');
        this.setState({
            ...this.state,
            isSignin: key ? true : false,
            isNightMode: nightmode ? true : false
        });
    }

    onClickNavigation() {
        let newState = this.state;
        newState.onNav = !newState.onNav;
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

    render() {
        return (
            <>
                <nav
                    onClick={() => this.onClickNavigation()}
                    className={`menu ${this.state.onNav ? 'on' : 'off' }`}
                >
                    <img src="https://static.blex.me/assets/images/logo.png"/>
                </nav>
                <div className={`side-menu serif ${this.state.onNav ? 'on' : 'off' }`}>
                    <div className="inner">
                        <ul className="menu-item">
                            <Link href="/">
                                <a><li>인기 포스트</li></a>
                            </Link>
                            <Link href="/newest">
                                <a><li>최신 포스트</li></a>
                            </Link>
                            <Link href="/tags">
                                <a><li>태그 클라우드</li></a>
                            </Link>
                        </ul>
                        {this.state.isSignin ? (
                            <ul className="menu-item">
                                <a>
                                    <li><i className="fas fa-user"></i> 내 블로그</li>
                                </a>
                                <a>
                                    <li><i className="fas fa-pencil-alt"></i> 포스트 작성</li>
                                </a>
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
                            {this.state.isSignin ? (
                                <li>
                                    <a><i class="fas fa-sign-out-alt"></i> 로그아웃</a>
                                </li>
                            ) : (
                                <li>
                                    <a><i className="fas fa-sign-in-alt"></i> 로그인</a> / <a>회원가입</a>
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