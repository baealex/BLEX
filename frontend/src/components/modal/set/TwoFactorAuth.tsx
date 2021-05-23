import React from 'react';
import Router from 'next/router';

import {
    Modal,
 } from '@components/integrated';

import { toast } from 'react-toastify';

import * as API from '@modules/api';
import Global from '@modules/global';

interface Props {
    isOpen: boolean;
    onClose: Function;
}

interface State {
    code: string;
    timer: number;
}

class LoginModal extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            code: '',
            timer: 0,
        }
    }

    componentDidUpdate(prevProps: Props) {
        if(prevProps.isOpen !== this.props.isOpen && this.props.isOpen) {
            this.setState({timer: 60 * 5});
            const timerEvent = setInterval(() => {
                if(this.state.timer <= 0) {
                    clearInterval(timerEvent);
                    return;
                }
                this.setState({timer: this.state.timer - 1});
            }, 1000);
        }
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
        if(this.state.code == '') {
            toast('😅 코드를 입력해주세요!');
            return;
        }
        const { data } = await API.postSecuritySend(this.state.code);
        this.loginCheck(data);
    }

    async onSocialLogin(social: string, code: string) {
        const { data } = await API.postSignSocialLogin(social, code);
        this.loginCheck(data);
    }

    async loginCheck(data: API.ResponseData<API.PostLoginData>) {
        if (data.status === 'ERROR') {
            if (data.errorCode === API.ERROR.EXPIRE) {
                toast('😥 코드가 만료되었습니다.');
            }

            if (data.errorCode === API.ERROR.REJECT) {
                toast('😥 코드를 확인하여 주십시오.');
            }
        }

        if (data.status == 'DONE') {
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
    }
    
    render() {
        const remainMinute = Math.floor(this.state.timer / 60);
        const remainSecond = this.state.timer % 60;
        const remainTime = `${remainMinute}:${remainSecond >= 10 ? remainSecond : `0${remainSecond}`}`
        return (
            <Modal
                title="2차 인증"
                isOpen={this.props.isOpen}
                onClose={() => {}}
            >
                <p>
                    텔레그램으로 전송된 2차 인증 코드를 입력하세요.
                    코드를 받을 수 없다면 복구키를 입력해 주십시오.
                    인증 코드 유효시간 {remainTime}
                </p>
                <input
                    className="login-form"
                    name="code"
                    placeholder="코드"
                    onChange={(e) => this.onInputChange(e)}
                    value={this.state.code}
                    onKeyPress={(e) => this.onEnterLogin(e)}
                />
                <button
                    className="login-button"
                    onClick={() => this.onSubmitLogin()}>
                    인증
                </button>
            </Modal>
        );
    }
}

export default LoginModal;