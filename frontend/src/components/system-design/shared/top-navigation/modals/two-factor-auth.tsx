import React from 'react';

import { Modal } from '@design-system';

import * as API from '@modules/api';
import { snackBar } from '@modules/ui/snack-bar';

import { authStore } from '@stores/auth';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

interface State {
    code: string;
    timer: number;
}

export class TwoFactorAuthModal extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            code: '',
            timer: 0
        };
    }

    componentDidUpdate(prevProps: Props) {
        if (prevProps.isOpen !== this.props.isOpen && this.props.isOpen) {
            this.setState({ timer: 60 * 5 });
            const timerEvent = setInterval(() => {
                if (this.state.timer <= 0) {
                    clearInterval(timerEvent);
                    return;
                }
                this.setState({ timer: this.state.timer - 1 });
            }, 1000);
        }
    }

    onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
        this.setState({
            ...this.state,
            [e.target.name]: e.target.value
        });
        if (e.target.value.length >= 6) {
            this.onSubmitLogin(e.target.value);
        }
    }

    async onSubmitLogin(code: string) {
        if (code == '') {
            snackBar('😅 코드를 입력해주세요!');
            return;
        }
        if (code.length < 6) {
            snackBar('😅 코드를 정확히 입력해주세요!');
            return;
        }
        const { data } = await API.postSecuritySend(code);
        this.loginCheck(data);
    }

    async onSocialLogin(social: string, code: string) {
        const { data } = await API.postSignSocialLogin(social, code);
        this.loginCheck(data);
    }

    async loginCheck(data: API.ResponseData<API.PostLoginData>) {
        if (data.status === 'ERROR') {
            if (data.errorCode === API.ERROR.EXPIRE) {
                snackBar('😥 코드가 만료되었습니다.');
            }

            if (data.errorCode === API.ERROR.REJECT) {
                snackBar('😥 코드를 확인하여 주십시오.');
            }

            this.setState({
                ...this.state,
                code: ''
            });
        }

        if (data.status == 'DONE') {
            snackBar('😃 로그인 되었습니다.');
            authStore.set({
                isLogin: true,
                ...data.body
            });

            this.props.onClose();
        }
    }

    render() {
        const remainMinute = Math.floor(this.state.timer / 60);
        const remainSecond = this.state.timer % 60;
        const remainTime = `${remainMinute}:${remainSecond >= 10 ? remainSecond : `0${remainSecond}`}`;
        return (
            <Modal
                title="2차 인증"
                isOpen={this.props.isOpen}
                onClose={this.props.onClose}>
                <p>
                    텔레그램으로 전송된 2차 인증코드를 입력하세요.
                    인증코드 유효 시간 {remainTime}
                </p>
                <input
                    className="login-form"
                    name="code"
                    type="number"
                    placeholder="코드"
                    onChange={(e) => this.onInputChange(e)}
                    value={this.state.code}
                    onKeyPress={(e) => {
                        if (e.key == 'Enter') {
                            this.onSubmitLogin(this.state.code);
                        }
                    }}
                />
                <button
                    className="login-button"
                    onClick={() => this.onSubmitLogin(this.state.code)}>
                    인증
                </button>
            </Modal>
        );
    }
}