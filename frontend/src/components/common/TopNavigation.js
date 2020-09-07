import React from 'react'
import Link from 'next/link'

class TopNavigation extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            onNav: false,
        };
    }

    onClickNavigation() {
        let newState = this.state;
        newState.onNav = !newState.onNav;
        this.setState(newState);
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
                        <ul className="menu-item">
                            <a href="">
                                <li><i className="fas fa-user"></i> 내 블로그</li>
                            </a>
                            <a href="javascript:void(0)">
                                <li><i className="fas fa-pencil-alt"></i> 포스트 작성</li>
                            </a>
                        </ul>
                        <ul className="menu-footer-item">
                            <li>
                                <a href="javascript:night()">
                                    <i className="fas fa-moon"></i>
                                </a>
                            </li>
                            <li>
                                <a href=""><i className="fas fa-sign-in-alt"></i> 로그인</a> / <a href="">회원가입</a>
                            </li>
                        </ul>
                    </div>
                </div>
            </>
        )
    }
}

export default TopNavigation;