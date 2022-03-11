import React from 'react';

import {
    Modal,
 } from '@design-system';

import { snackBar } from '@modules/ui/snack-bar';
import { message } from '@modules/utility/message';

import * as API from '@modules/api';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

interface State {
    token: string;
}

export class TelegramSyncModal extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            token: '',
        }
    }

    async componentDidUpdate() {
        if(this.props.isOpen && !this.state.token) {
            const { data } = await API.postTelegram('makeToken');
            if (data.status === 'ERROR') {
                snackBar(message('AFTER_REQ_ERR', data.errorMessage));
                return;
            }
            this.setState({token: data.body.token || ''});
        }
    }
    
    render() {
        return (
            <Modal
                title="텔레그램 연동"
                isOpen={this.props.isOpen}
                onClose={this.props.onClose}
            >
                <>
                    텔레그램과 연동하면 어떤 효과가 있나요?
                    <ul>
                        <li>실시간으로 회원님의 알림을 전달해 드립니다.</li>
                        <li>로그인시 2차 인증을 사용할 수 있습니다.</li>
                    </ul>
                    어떻게 연동하나요?
                    <ul>
                        <li>텔레그램을 실행하시고 <a href="http://t.me/blex_bot" className="shallow-dark">@blex_bot</a>을 추가해주세요!</li>
                        <li>봇에게 <code>{this.state.token}</code>라고 말해주세요!</li>
                    </ul>
                    해당 토큰은 회원님을 위해 생성된 일회성 토큰이며 연동을 완료되거나 오늘이 지나면 파기됩니다.
                </>
            </Modal>
        );
    }
}