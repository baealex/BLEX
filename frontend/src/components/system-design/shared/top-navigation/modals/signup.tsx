import React from 'react';

import {
    Alert,
    Modal,
    SplitLine
} from '@design-system';

import { snackBar } from '@modules/ui/snack-bar';

import * as API from '@modules/api';
import { oauth } from '@modules/utility/oauth';

import { modalStore } from '@stores/modal';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

interface State {
    username: string;
    realname: string;
    password: string;
    passwordCheck: string;
    email: string;
    isDone: boolean;
}

export class SignupModal extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            username: '',
            realname: '',
            password: '',
            passwordCheck: '',
            email: '',
            isDone: false
        };
    }

    onEnterLogin(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key == 'Enter') {
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
        if (this.state.username == '') {
            snackBar('😅 사용자 이름을 입력해주세요!');
            return;
        }
        if (this.state.password == '') {
            snackBar('😅 비밀번호를 입력해주세요!');
            return;
        }
        if (this.state.password !== this.state.passwordCheck) {
            snackBar('😅 비밀번호가 일치하지 않습니다!');
            return;
        }
        if (this.state.email == '') {
            snackBar('😅 이메일을 입력해주세요!');
            return;
        }
        if (this.state.realname == '') {
            snackBar('😅 사용자 실명을 입력해주세요!');
            return;
        }
        const { data } = await API.postSign(
            this.state.username,
            this.state.password,
            this.state.email,
            this.state.realname
        );
        if (data.status === 'ERROR') {
            if (data.errorCode) {
                if (data.errorMessage) {
                    snackBar(data.errorMessage);
                    return;
                }
            }
        }
        if (data.status === 'DONE') {
            this.setState({ isDone: true });
        }
    }

    render() {
        return (
            <Modal title="회원등록" isOpen={this.props.isOpen} onClose={() => this.props.onClose()}>
                {this.state.isDone ? (
                    <div className="mx-auto bg-border-purple p-3 bg-light deep-dark">
                        {this.state.realname}님의 가입을 진심으로 환영합니다! 💜
                        입력하신 '{this.state.email}'로 메일을 발송하겠습니다! 🚀
                        보내는 메일은 'im@baejino.com'이며 유사 메일에 유의하시길 바랍니다.
                        메일 발송의 지연을 막기 위해서 간소한 형식으로 인증 메일을 발송하고 있으니 양해 부탁드립니다. 😁
                        행여나 메일이 도착하지 않는다면 입력하신 메일이 틀리진 않았는지 확인해 주시고,
                        입력하신 메일이 맞다면 위 메일로 문의 부탁드립니다. 😥
                    </div>
                ) : (
                    <>
                        <input
                            className="login-form"
                            name="username"
                            placeholder="사용자 이름"
                            onChange={(e) => this.onInputChange(e)}
                            value={this.state.username}
                            onKeyPress={(e) => this.onEnterLogin(e)}
                        />
                        {this.state.username && (
                            <Alert type="infomation">
                                {`https://blex.me/@${this.state.username}`}
                            </Alert>
                        )}
                        <input
                            className="login-form"
                            name="password"
                            type="password"
                            placeholder="비밀번호"
                            onChange={(e) => this.onInputChange(e)}
                            value={this.state.password}
                            onKeyPress={(e) => this.onEnterLogin(e)}
                        />
                        <input
                            className="login-form"
                            name="passwordCheck"
                            type="password"
                            placeholder="비밀번호 확인"
                            onChange={(e) => this.onInputChange(e)}
                            value={this.state.passwordCheck}
                            onKeyPress={(e) => this.onEnterLogin(e)}
                        />
                        <input
                            className="login-form"
                            name="realname"
                            placeholder="사용자 실명"
                            onChange={(e) => this.onInputChange(e)}
                            value={this.state.realname}
                            onKeyPress={(e) => this.onEnterLogin(e)}
                        />
                        <input
                            className="login-form"
                            name="email"
                            type="email"
                            placeholder="이메일"
                            onChange={(e) => this.onInputChange(e)}
                            value={this.state.email}
                            onKeyPress={(e) => this.onEnterLogin(e)}
                        />
                        <button
                            className="login-button"
                            onClick={() => this.onSubmitLogin()}>
                            등록 후 이메일 인증
                        </button>
                        <SplitLine/>
                        <button
                            className="login-button google"
                            onClick={() => oauth('google')}>
                            <i className="fab fa-google"/> Google 계정으로 시작
                        </button>
                        <button
                            className="login-button github"
                            onClick={() => oauth('github')}>
                            <i className="fab fa-github"/> GitHub 계정으로 시작
                        </button>
                        <div className="login-hint">
                            <button
                                onClick={async () => {
                                    await modalStore.close('isSignupModalOpen');
                                    await modalStore.open('isLoginModalOpen');
                                }}>
                                이미 회원이신가요?
                            </button>
                        </div>
                    </>
                )}
            </Modal>
        );
    }
}