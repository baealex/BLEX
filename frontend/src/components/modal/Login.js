import React from 'react';
import Modal from '../common/Modal';

import { toast } from 'react-toastify';

import API from '../../modules/api';
import Global from '../../modules/global';
import Config from '../../modules/config.json';

class LoginModal extends React.Component {
    constructor(props) {
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

    onEnterLogin(e) {
        if(e.key == 'Enter') {
            this.onSubmitLogin();
        }
    }

    onInputChange(e) {
        let newState = this.state;
        newState[e.target.name] = e.target.value;
        this.setState(newState);
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

    async onSocialLogin(social, code) {
        const { data } = await API.socialLogin(social, code);
        this.loginCheck(data);
    }

    async loginCheck(data) {
        let newState = this.state;
        if(data.status == 'success') {
            toast(`😃 로그인 되었습니다.`);
            Global.setState({
                ...Global.state,
                isLogin: true,
                username: data.username
            });

            if(data.notify_count != 0) {
                toast(`😲 읽지 않은 알림이 ${data.notify_count}개 있습니다.`)
            }
            this.props.onClose();
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
        window.___run = async (social, code) => {
            await this.onSocialLogin(social, code);
        };
        window.open(url, 'Social Login', 'width=550,height=750');
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