import React from 'react';
import Router from 'next/router';

import { Modal } from '@design-system';

import * as API from '@modules/api';
import { snackBar } from '@modules/ui/snack-bar';

import { authStore } from '@stores/auth';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

interface State {
    token: string;
}

export class SignoutModal extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { token: '' };
    }

    async onSignOut() {
        const { data } = await API.deleteSign();
        if (data.status === 'DONE') {
            snackBar('😀 계정이 삭제되었습니다.');
            authStore.logout();
            this.props.onClose();
            Router.push('/');
        }
    }

    render() {
        return (
            <Modal
                title="정말 탈퇴 하시겠습니까?"
                isOpen={this.props.isOpen}
                onClose={this.props.onClose}
                submitText="네 탈퇴할게요."
                onSubmit={this.onSignOut.bind(this)}
            >
                <>
                    다음 정보가 즉시 삭제됩니다.
                    <ul>
                        <li>내 정보</li>
                        <li>작성한 댓글</li>
                        <li>작성한 포스트</li>
                        <li>생성한 시리즈</li>
                        <li>작성중인 임시글</li>
                        <li>포스트 하이라이팅</li>
                    </ul>
                    이 작업은 되돌릴 수 없으니 신중하게 선택해 주시기 바랍니다.
                </>
            </Modal>
        );
    }
}