import React from 'react';

import { Modal } from '~/components/design-system';

import { oauth } from '~/modules/utility/oauth';

import { modalStore } from '~/stores/modal';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export function AccountCreateModal(props: Props) {
    return (
        <Modal title="회원가입" isOpen={props.isOpen} onClose={props.onClose}>
            <button
                className="login-button google"
                onClick={() => oauth('google')}>
                <i className="fab fa-google" /> Google 계정으로 시작
            </button>
            <button
                className="login-button github"
                onClick={() => oauth('github')}>
                <i className="fab fa-github" /> GitHub 계정으로 시작
            </button>
            <div className="login-hint">
                <button
                    onClick={async () => {
                        await modalStore.close('isOpenAccountCreateModal');
                        await modalStore.open('isOpenAuthGetModal');
                    }}>
                    이미 회원이신가요?
                </button>
            </div>
        </Modal>
    );
}
