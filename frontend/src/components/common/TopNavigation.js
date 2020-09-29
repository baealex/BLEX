import React from 'react';
import Link from 'next/link';

import { toast } from 'react-toastify';

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
            search: '',
            token: '',
            notify: [],
            showLoginModal: false,
            showNotifyModal: false,
            error: ''
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
            if(alive.data.notify.length > 0) {
                this.setState({
                    ...this.setState,
                    notify: alive.data.notify
                });
                toast(`😲 읽지 않은 알림이 ${alive.data.notify.length}개 있습니다.`)
            }
        }
    }

    onClickNavigation() {
        this.setState({
            ...this.state,
            onNav: !this.state.onNav
        });
    }

    onShowModal(modalName) {
        if(modalName == 'showTelegramModal') {
            
        }
        let newState = this.state;
        newState[modalName] = true;
        this.setState(newState);
    }

    onCloseModal(modalName) {
        let newState = this.state;
        newState[modalName] = false;
        this.setState(newState);
    }

    onEnterSearch(e) {
        if(e.key == 'Enter') {
            window.open('about:blank').location.href = `https://www.google.com/search?q=${encodeURIComponent(`${this.state.search} site:blex.me`)}`;
        }
    }

    onEnterLogin(e) {
        if(e.key == 'Enter') {
            this.onSubmitLogin();
        }
    }

    async onSubmitLogin() {
        if(this.state.username == '') {
            toast('😅 아이디를 입력해주세요!')
            return;
        }
        if(this.state.password == '') {
            toast('😅 비밀번호를 입력해주세요!')
            return;
        }
        let newState = this.state;
        const { data } = await API.login(this.state.username, this.state.password);
        if(data.status == 'success') {
            toast(`😃 로그인 되었습니다.`);
            newState.showLoginModal = false;
            newState.isLogin = true;
            Global.setState({
                ...Global.state,
                isLogin: true,
                username: data.username
            });

            if(data.notify.length > 0) {
                this.setState({
                    ...this.setState,
                    notify: data.notify
                });
                toast(`😲 읽지 않은 알림이 ${data.notify.length}개 있습니다.`)
            }
        } else {
            toast('😥 아이디 혹은 패스워드를 확인해주세요.');
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
            }
            toast('😥 로그아웃 되었습니다.', toast.TYPE.INFO);
        }
    }

    render() {
        return (
            <>
                <Modal title='로그인' show={this.state.showLoginModal} close={() => this.onCloseModal('showLoginModal')}>
                    <div className="content">
                        <input
                            className='login-form'
                            name='username'
                            placeholder='username'
                            onChange={(e) => this.onInputChange(e)}
                            value={this.state.username}
                            onKeyPress={(e) => this.onEnterLogin(e)}
                        />
                        <input
                            className='login-form'
                            name='password'
                            type='password'
                            placeholder='password'
                            onChange={(e) => this.onInputChange(e)}
                            value={this.state.password}
                            onKeyPress={(e) => this.onEnterLogin(e)}
                        />
                        <button
                            className='login-button'
                            onClick={() => this.onSubmitLogin()}>
                            로그인
                        </button>
                        <button
                            className='login-button google'
                            onClick={() => this.onSubmitSocialLogin('google')}>
                            <i className="fab fa-google"></i> Google 로그인
                        </button>
                        <button
                            className='login-button github'
                            onClick={() => this.onSubmitSocialLogin('github')}>
                            <i className="fab fa-github"></i> GitHub 로그인
                        </button>
                    </div>
                </Modal>
                <Modal title='알림' show={this.state.showNotifyModal} close={() => this.onCloseModal('showNotifyModal')}>
                    <div className="content">
                        {this.state.notify.map((item, idx) => (
                            <div className="blex-card p-3 my-2">
                                {item.content}
                            </div>
                        ))}
                    </div>
                    <div className="button-wrap">
                        <button><i className="fab fa-telegram-plane"></i> 텔레그램 연동하고 실시간 알림받기</button>
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
                        <input
                            autocomplete="off"
                            className="search"
                            name='search'
                            type='text'
                            value={this.state.search}
                            placeholder="Serach"
                            onChange={(e) => this.onInputChange(e)}
                            onKeyPress={(e) => this.onEnterSearch(e)}
                        />
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
                                    <a onClick={() => this.onShowModal('showNotifyModal')}><i className="far fa-envelope"></i> 알림{this.state.notify.length > 0 ? ` (${this.state.notify.length})` : ''}</a>
                                </li>
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
                                    <a onClick={() => this.onShowModal('showLoginModal')}>
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