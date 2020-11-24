import React from 'react';

import Modal from '@components/common/Modal';

import { toast } from 'react-toastify';

import API from '@modules/api';
import Cookie from '@modules/cookie';
import Global from '@modules/global';
import Config from '@modules/config.json';

interface Props {
    isOpen: boolean;
    onClose: Function;
}

interface State {
    username: string;
    password: string;
}

class LoginModal extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            username: Global.state.username,
            password: ''
        }
        Global.appendUpdater('LoginModal', () => this.setState({
            ...this.state,
            username: Global.state.username,
        }));
    }

    onEnterLogin(e: React.KeyboardEvent<HTMLInputElement>) {
        if(e.key == 'Enter') {
            this.onSubmitLogin();
        }
    }

    onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
        this.setState({
            ...this.state,
            [e.target.name]: e.target.value
        });
    }

    async onSubmitLogin() {
        if(this.state.username == '') {
            toast('😅 아이디를 입력해주세요!');
            return;
        }
        if(this.state.password == '') {
            toast('😅 비밀번호를 입력해주세요!');
            return;
        }
        const { data } = await API.login(this.state.username, this.state.password);
        this.loginCheck(data);
    }

    async onSocialLogin(social: string, code: string) {
        const { data } = await API.socialLogin(social, code);
        this.loginCheck(data);
    }

    async loginCheck(data: {
        status: string;
        username: string;
        notifyCount: number;
    }) {
        if(data.status == 'success') {
            toast(`😃 로그인 되었습니다.`);
            Global.setState({
                ...Global.state,
                isLogin: true,
                username: data.username
            });

            if(data.notifyCount != 0) {
                toast(`😲 읽지 않은 알림이 ${data.notifyCount}개 있습니다.`, {
                    onClick:() => {
                        Global.onOpenModal('isSettingModalOpen');
                    }
                })
            }
            this.props.onClose();
        } else {
            toast('😥 아이디 혹은 패스워드를 확인해주세요.');
        }
        this.setState({
            ...this.state,
            password: ''
        });
    }

    onSubmitSocialLogin(social: string) {
        Cookie.set('oauth_redirect', location.href, {
            path: '/',
            expire: 0.1,
        });
        let url = '';
        switch(social) {
            case 'google':
                url += 'https://accounts.google.com/o/oauth2/auth';
                url += `?client_id=${Config.GOOGLE_OAUTH_CLIENT_ID}.apps.googleusercontent.com`;
                url += `&redirect_uri=${window.location.protocol}//${window.location.hostname}/login/callback/google`;
                url += '&response_type=code';
                url += '&scope=openid profile email'
                url += '&approval_prompt=force'
                url += '&access_type=offline'
                break;
            case 'github':
                url += 'https://github.com/login/oauth/authorize';
                url += `?client_id=${Config.GITHUB_OAUTH_CLIENT_ID}`;
                url += `&redirect_uri=${window.location.protocol}//${window.location.hostname}/login/callback/github`;
                break;
        }
        location.href = url;
    }
    
    render() {
        return (
            <Modal title='로그인' isOpen={this.props.isOpen} close={() => this.props.onClose()}>
                <div className="content noto">
                    <input
                        className="login-form"
                        name="username"
                        placeholder="Username"
                        onChange={(e) => this.onInputChange(e)}
                        value={this.state.username}
                        onKeyPress={(e) => this.onEnterLogin(e)}
                    />
                    <input
                        className="login-form"
                        name="password"
                        type="password"
                        placeholder="Password"
                        onChange={(e) => this.onInputChange(e)}
                        value={this.state.password}
                        onKeyPress={(e) => this.onEnterLogin(e)}
                    />
                    <button
                        className="login-button"
                        onClick={() => this.onSubmitLogin()}>
                        기존 사용자 로그인
                    </button>
                    <button
                        className="login-button google"
                        onClick={() => this.onSubmitSocialLogin("google")}>
                        <i className="fab fa-google"></i> Google로 시작하기
                    </button>
                    <button
                        className="login-button github"
                        onClick={() => this.onSubmitSocialLogin("github")}>
                        <i className="fab fa-github"></i> GitHub로 시작하기
                    </button>
                </div>
            </Modal>
        );
    }
}

export default LoginModal;