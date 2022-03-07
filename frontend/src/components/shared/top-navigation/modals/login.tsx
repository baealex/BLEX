import React from 'react';

import {
    Modal,
    SplitLine,
} from '@design-system';

import * as API from '@modules/api';
import { snackBar } from '@modules/ui/snack-bar';
import { message } from '@modules/utility/message';
import { oauth } from '@modules/utility/oauth';

import { authStore } from 'stores/auth';
import { modalStore } from 'stores/modal';

interface Props {
    isOpen: boolean;
    onClose: Function;
}

interface State {
    username: string;
    password: string;
}

export class LoginModal extends React.Component<Props, State> {
    private updateKey: string;

    constructor(props: Props) {
        super(props);
        this.state = {
            username: authStore.state.username,
            password: ''
        }
        this.updateKey = authStore.subscribe((state) => this.setState({
            username: state.username,
        }));
    }

    componentWillUnmount() {
        authStore.unsubscribe(this.updateKey);
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
            snackBar('😅 사용자 이름을 입력해주세요!');
            return;
        }
        if(this.state.password == '') {
            snackBar('😅 비밀번호를 입력해주세요!');
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
            snackBar(message('AFTER_REQ_ERR', '사용자 이름 혹은 패스워드를 확인해 주세요.'));
        }

        if (data.status === 'DONE') {
            if (data.body.security) {
                snackBar(message('AFTER_REQ_DONE', '2차 인증 코드를 입력해 주세요.'));
                modalStore.onOpenModal('isTwoFactorAuthModalOpen');
                this.props.onClose();
                return;
            }

            snackBar(message('AFTER_REQ_DONE', '로그인 되었습니다.'));
            authStore.setState({
                isLogin: true,
                ...data.body,
            });

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
                    placeholder="사용자 이름"
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
                    사용자 이름으로 로그인
                </button>
                <SplitLine/>
                <button
                    className="login-button google"
                    onClick={() => oauth("google")}
                >
                    <i className="fab fa-google"></i> Google 계정으로 로그인
                </button>
                <button
                    className="login-button github"
                    onClick={() => oauth("github")}
                >
                    <i className="fab fa-github"></i> GitHub 계정으로 로그인
                </button>
                <div className="login-hint">
                    <button
                        onClick={async () => {
                            await modalStore.onCloseModal('isLoginModalOpen');
                            await modalStore.onOpenModal('isSignupModalOpen');
                        }}
                    >
                        아직 회원이 아니세요?
                    </button>
                </div>
            </Modal>
        );
    }
}