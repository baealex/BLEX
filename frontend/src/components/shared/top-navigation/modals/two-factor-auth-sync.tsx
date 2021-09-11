import React from 'react';

import {
    Modal,
 } from '@components/integrated';

import { toast } from 'react-toastify';

import * as API from '@modules/api';

import { modalContext } from '@state/modal';
import { authContext } from '@state/auth';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

interface State {
    token: string;
}

export class TwoFactorAuthSyncModal extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            token: '',
        }
    }

    async onCreateTwoFactorAuth() {
        const { data } = await API.postSecurity();
        if (data.status === 'ERROR') {
            if (data.errorCode === API.ERROR.NOT_LOGIN) {
                toast('😥 로그인이 필요합니다.');
                return;
            }
            if (data.errorCode === API.ERROR.NEED_TELEGRAM) {
                toast('😥 텔레그램 연동이 필요합니다.', {
                    onClick: () => modalContext.onOpenModal('isTelegramSyncModalOpen')
                });
                return;
            }
            if (data.errorCode === API.ERROR.ALREADY_EXISTS) {
                toast('😥 이미 등록되어 있습니다.');
                return;
            }
        }
        if (data.status === 'DONE') {
            toast('😀 2차 인증이 등록되었습니다.');
            authContext.setState((prevState) => ({
                ...prevState,
                is2faSync: true,
            }));

            this.props.onClose();
            return;
        }
        toast('😥 등록중 오류가 발생했습니다.');
    }
    
    render() {
        return (
            <Modal
                title="2차 인증을 사용할까요?"
                isOpen={this.props.isOpen}
                onClose={this.props.onClose}
                submitText="네 사용할게요."
                onSubmit={this.onCreateTwoFactorAuth.bind(this)}
            >
                <>
                    다음과 같은 요구사항이 필요합니다.
                    <ul>
                        <li>
                            텔레그램 연동이 선행되어야 합니다.
                        </li>
                        <li>
                            계정에 등록된 이메일이 유효해야 합니다.
                            등록된 이메일로 복구키를 전송하며
                            복구키는 핸드폰을 소지하지 않았거나
                            기술적인 문제로 인증코드가 전달되지 않았을 때
                            사용할 수 있습니다.
                        </li>
                    </ul>
                    연동 후 최소 하루동안 유지해야 하므로 신중하게 연동하여 주십시오.
                </>
            </Modal>
        );
    }
}