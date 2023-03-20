import styles from './styles.module.scss';

import React from 'react';

import {
    Modal,
    SplitLine
} from '@design-system';

import * as API from '~/modules/api';
import { message } from '~/modules/utility/message';
import { oauth } from '~/modules/utility/oauth';
import { snackBar } from '~/modules/ui/snack-bar';

import { authStore } from '~/stores/auth';
import { modalStore } from '~/stores/modal';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

interface State {
    username: string;
    password: string;
}

export class AuthGetModal extends React.Component<Props, State> {
    private updateKey: string;

    constructor(props: Props) {
        super(props);
        this.state = {
            username: authStore.state.username,
            password: ''
        };
        this.updateKey = authStore.subscribe((state) => this.setState({ username: state.username }));
    }

    componentWillUnmount() {
        authStore.unsubscribe(this.updateKey);
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
            snackBar('😅 아이디를 입력해주세요!');
            return;
        }
        if (this.state.password == '') {
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

    async loginCheck(data: API.ResponseData<API.PostLoginResponseData>) {
        if (data.status === 'ERROR') {
            snackBar(message('AFTER_REQ_ERR', '아이디 혹은 비밀번호를 확인해 주세요.'));
        }

        if (data.status === 'DONE') {
            if (data.body.security) {
                snackBar(message('AFTER_REQ_DONE', '2차 인증 코드를 입력해 주세요.'));
                modalStore.open('isOpenTwoFactorAuthGetModal');
                this.props.onClose();
                return;
            }

            snackBar(message('AFTER_REQ_DONE', '로그인 되었습니다.'));
            authStore.set((prevState) => ({
                ...prevState,
                ...data.body,
                isLogin: true
            }));

            this.props.onClose();
        }
        this.setState({ password: '' });
    }

    render() {
        return (
            <Modal
                title=""
                size="medium"
                isOpen={this.props.isOpen}
                onClose={() => this.props.onClose()}>
                <div className={styles.split}>
                    <div className={styles.welcome}>
                        <img src="/illustrators/welcome.svg"/>
                        <p>
                            당신이 찾던 예쁘고 유니크한 블로그
                        </p>
                    </div>
                    <div>
                        <button
                            className="login-button google"
                            onClick={() => oauth('google')}>
                            <i className="fab fa-google"></i> Google 계정으로 로그인
                        </button>
                        <button
                            className="login-button github"
                            onClick={() => oauth('github')}>
                            <i className="fab fa-github"></i> GitHub 계정으로 로그인
                        </button>
                        <SplitLine/>
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
                            placeholder="비밀번호"
                            onChange={(e) => this.onInputChange(e)}
                            value={this.state.password}
                            onKeyPress={(e) => this.onEnterLogin(e)}
                        />
                        <button
                            className="login-button"
                            onClick={() => this.onSubmitLogin()}>
                            BLEX 계정으로 로그인
                        </button>
                        <div className="login-hint">
                            <button
                                onClick={async () => {
                                    await modalStore.close('isOpenAuthGetModal');
                                    await modalStore.open('isOpenAccountCreateModal');
                                }}>
                                아직 회원이 아니세요?
                            </button>
                        </div>
                    </div>
                </div>
            </Modal>
        );
    }
}
