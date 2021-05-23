import React from 'react';
import Router from 'next/router';

import { Modal } from '@components/common';

import { toast } from 'react-toastify';

import * as API from '@modules/api';
import Global from '@modules/global';
import { oauth } from '@modules/oauth';

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
        Global.appendUpdater(() => this.setState({
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
        const { data } = await API.postLogin(this.state.username, this.state.password);
        this.loginCheck(data);
    }

    async onSocialLogin(social: string, code: string) {
        const { data } = await API.postSignSocialLogin(social, code);
        this.loginCheck(data);
    }

    async loginCheck(data: API.ResponseData<API.PostLoginData>) {
        if (data.status === 'ERROR') {
            toast('😥 아이디 혹은 패스워드를 확인해 주세요.');
        }

        if (data.status === 'DONE') {
            if (data.body.security) {
                toast('😃 2차 인증 코드를 입력해 주세요.');
                Global.onOpenModal('isTwoFactorAuthModalOpen');
                this.props.onClose();
                return;
            }

            toast(`😃 로그인 되었습니다.`);
            Global.setState({
                isLogin: true,
                username: data.body.username
            });

            if(data.body.notifyCount != 0) {
                toast(`😲 읽지 않은 알림이 ${data.body.notifyCount}개 있습니다.`, {
                    onClick:() => {
                        Router.push('/setting');
                    }
                })
            }
            this.props.onClose();
        }
        this.setState({
            password: ''
        });
    }
    
    render() {
        return (
            <Modal
                title="로그인"
                isOpen={this.props.isOpen}
                onClose={() => this.props.onClose()}
            >
                <input
                    className="login-form"
                    name="username"
                    placeholder="아이디"
                    onChange={(e) => this.onInputChange(e)}
                    value={this.state.username}
                    onKeyPress={(e) => this.onEnterLogin(e)}
                />
                <input
                    className="login-form"
                    name="password"
                    type="password"
                    placeholder="패스워드"
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
                    onClick={() => oauth("google")}>
                    <i className="fab fa-google"></i> Google 계정으로 로그인
                </button>
                <button
                    className="login-button github"
                    onClick={() => oauth("github")}>
                    <i className="fab fa-github"></i> GitHub 계정으로 로그인
                </button>
            </Modal>
        );
    }
}

export default LoginModal;