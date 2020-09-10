import React from 'react';
import Link from 'next/link';

import Modal from '../../components/common/Modal';

import Cookie from '../../modules/cookie';
import API from '../../modules/api';
import Global from '../../modules/global';

class TopNavigation extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            onNav: false,
            isNightMode: false,
            isLogin: Global.state.isLogin,
            username: Global.state.username,
            password: '',
            showLoginModal: false,
            error: ''
        };
        Global.appendUpdater('TopNavigation', () => this.setState({
            ...this.state,
            isLogin: Global.state.isLogin,
            username: Global.state.username,
        }));
    }

    async componentDidMount(){
        this.bodyClass = document.querySelector('body').classList;
        const nightmode = Cookie.get('nightmode');
        nightmode === 'true' && this.bodyClass.add('dark');
        this.setState({
            ...this.state,
            isNightMode: nightmode ? true : false,
        });

        const alive = await API.alive();
        Global.setState({
            ...Global.state,
            isLogin: alive.data !== 'dead' ? true : false,
            username: alive.data !== 'dead' ? alive.data : '',
        });
    }

    onClickNavigation() {
        this.setState({
            ...this.state,
            onNav: !this.state.onNav
        });
    }

    onClickLogin() {
        this.setState({
            ...this.state,
            showLoginModal: true
        });
    }

    onCloseModal(modalName) {
        let newState = this.state;
        newState[modalName] = false;
        this.setState(newState);
    }

    async onSubmitLogin() {
        let newState = this.state;
        const { data } = await API.login(this.state.username, this.state.password);
        if(data.status == 'success') {
            alert(`로그인 되었습니다.`);
            newState.showLoginModal = false;
            newState.isLogin = true;
            Global.setState({
                ...Global.state,
                isLogin: true
            });
        } else {
            alert('아이디 혹은 패스워드를 확인해주세요.');
        }
        newState.password = '';
        this.setState(newState);
    }

    onSubmitSocialLogin(social) {
        let url = '';
        switch(social) {
            case 'google':
                url += 'https://accounts.google.com/o/oauth2/auth';
                url += '?client_id=230716131865-ann8gcfd9b3oq3d6funkkb5r8k1d9d3o.apps.googleusercontent.com';
                url += '&redirect_uri=' + window.location.protocol + '//' + window.location.hostname + '/login/callback/google';
                url += '&response_type=code';
                url += '&scope=openid profile email'
                url += '&approval_prompt=force'
                url += '&access_type=offline'
                break;
            case 'github':
                url += 'https://github.com/login/oauth/authorize';
                url += '?client_id=c5b001b86e3e77f2af1f';
                url += '&redirect_uri=' + window.location.protocol + '//' + window.location.hostname + '/login/callback/github';
                break;
        }
        location.href = url;
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
        if(confirm('정말 로그아웃 하시겠습니까?')) {
            const { data } = await API.logout();
            if(data.status === 'success') {
                Global.setState({
                    ...Global.state,
                    isLogin: false
                });
            }
            alert('로그아웃 되었습니다.');
        }
    }

    render() {
        return (
            <>
                <Modal show={this.state.showLoginModal} close={() => this.onCloseModal('showLoginModal')}>
                    <div className="content">
                        <input
                            className='login-form'
                            name='username'
                            placeholder='username'
                            onChange={(e) => this.onInputChange(e)}
                            value={this.state.username}
                        />
                        <input
                            className='login-form'
                            name='password'
                            type='password'
                            placeholder='password'
                            onChange={(e) => this.onInputChange(e)}
                            value={this.state.password}
                        />
                        <button
                            className='login-button'
                            onClick={() => this.onSubmitLogin()}>
                            로그인
                        </button>
                        <button
                            className='login-button google'
                            onClick={() => this.onSubmitSocialLogin('google')}>
                            <i class="fab fa-google"></i> Google 로그인
                        </button>
                        <button
                            className='login-button github'
                            onClick={() => this.onSubmitSocialLogin('github')}>
                            <i class="fab fa-github"></i> GitHub 로그인
                        </button>
                    </div>
                </Modal>
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
                                    <a onClick={() => this.onClickLogin()}>
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