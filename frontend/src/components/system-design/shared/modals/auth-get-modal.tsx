import styles from './styles.module.scss';

import React from 'react';

import {
    Button,
    Modal,
    SplitLine
} from '@design-system';

import * as API from '~/modules/api';
import { CONFIG } from '~/modules/settings';
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
    isLoading: boolean;
}

export class AuthGetModal extends React.Component<Props, State> {
    private updateKey: string;

    constructor(props: Props) {
        super(props);
        this.state = {
            username: authStore.state.username,
            password: '',
            isLoading: false
        };
        this.updateKey = authStore.subscribe((state) => this.setState({ username: state.username }));
    }

    componentWillUnmount() {
        authStore.unsubscribe(this.updateKey);
    }

    onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
        this.setState({
            ...this.state,
            [e.target.name]: e.target.value
        });
    }

    async handleSubmitLogin(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (this.state.isLoading) {
            return;
        }
        if (this.state.username == '') {
            snackBar('😅 아이디를 입력해주세요!');
            return;
        }
        if (this.state.password == '') {
            snackBar('😅 비밀번호를 입력해주세요!');
            return;
        }
        this.setState({ isLoading: true });

        const { data } = await API.postLogin(this.state.username, this.state.password);

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
        this.setState({
            password: '',
            isLoading: false
        });
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
                        <img src="/illustrators/welcome.svg" />
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
                        <SplitLine />
                        <form onSubmit={this.handleSubmitLogin.bind(this)}>
                            <input
                                className="login-form"
                                name="username"
                                placeholder="아이디"
                                onChange={this.onInputChange.bind(this)}
                                value={this.state.username}
                            />
                            <input
                                className="login-form"
                                name="password"
                                type="password"
                                placeholder="비밀번호"
                                onChange={this.onInputChange.bind(this)}
                                value={this.state.password}
                            />
                            <Button
                                type="submit"
                                className="login-button"
                                isLoading={this.state.isLoading}>
                                {CONFIG.BLOG_TITLE} 계정으로 로그인
                            </Button>
                        </form>
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
