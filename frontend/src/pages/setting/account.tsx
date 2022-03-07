import React, { useEffect, useState } from 'react';
import type {
    GetServerSidePropsContext,
    GetServerSidePropsResult,
} from 'next';

import {
    Alert,
    Button,
    CheckBox,
    Text,
} from '@design-system';
import { Layout } from '@components/setting';

import * as API from '@modules/api';
import { snackBar } from '@modules/ui/snack-bar';
import { message } from '@modules/utility/message';

import { authStore } from 'stores/auth';
import { modalStore } from 'stores/modal';

interface Props extends API.GetSettingAccountData {}

export async function getServerSideProps({
    req,
}: GetServerSidePropsContext
): Promise<GetServerSidePropsResult<Props>> {
    const { data } = await API.getSettingAcount({
        'Cookie': req.headers.cookie || '',
    });
    if (data.errorCode === API.ERROR.NOT_LOGIN) {
        return {
            redirect: {
                destination: '/',
                permanent: false,
            }
        }
    }
    return {
        props: data.body
    };
}

export default function AccountSetting(props: Props) {
    const [ isChangeUsername, setChangeUsername ] = useState(false);
    const [ username, setUsername ] = useState(props.username);
    const [ realname, setRealname ] = useState(props.realname);
    const [ password, setPassword ] = useState('');
    const [ is2faSync, setIs2faSync ] = useState(authStore.state.is2faSync);
    const [ passwordCheck, setPasswordCheck ] = useState('');
    const [ showEmail, setShowEmail ] = useState(props.showEmail);
    const [ agreeEmail, setAgreeEmail ] = useState(props.agreeEmail);
    const [ agreeHistory, setAgreeHistory ] = useState(props.agreeHistory);

    useEffect(authStore.syncValue('is2faSync', setIs2faSync), []);

    const onChangeUsername = async () => {
        const { data } = await API.patchSign({ username });
        if (data.status === 'ERROR') {
            snackBar(message('AFTER_REQ_ERR', data.errorMessage));
            setUsername(props.username);
            setChangeUsername(false);
            return;
        }
        if (data.status === 'DONE') {
            snackBar('😀 아이디가 변경되었습니다.');
            authStore.setState((state) => ({
                ...state,
                username: username,
            }));
            setChangeUsername(false);
        }
    };

    const onSubmit = async () => {
        let sendData: any = {};
        if (!realname) {
            snackBar('🤔 이름은 비워둘 수 없습니다.');
            return;
        }

        if (props.realname != realname) {
            sendData.realname = realname;
        }

        if (password) {
            if (password != passwordCheck) {
                snackBar('🤔 입력한 패스워드가 서로 다릅니다.');
                return;
            }
            sendData.password = password;
        }

        sendData.show_email = showEmail;
        sendData.agree_email = agreeEmail;
        sendData.agree_history = agreeHistory;

        const { data } = await API.putSetting('account', sendData);
        if (data.status === 'DONE') {
            snackBar('😀 기타 정보가 업데이트 되었습니다.');
        }
        setPassword('');
        setPasswordCheck('');
    };

    const onDeleteTwoFactorAuth = async () => {
        const { data } = await API.deleteSecurity();
        if (data.status === 'ERROR') {
            if (data.errorCode == API.ERROR.ALREADY_UNSYNC) {
                snackBar('😥 이미 해제되어 있습니다.');
                return;
            }
            if (data.errorCode == API.ERROR.REJECT) {
                snackBar('😥 인증을 해제할 수 없습니다.');
                return;
            }
        }
        if (data.status === 'DONE') {
            snackBar('😀 2차 인증이 해제되었습니다.');
            authStore.setState((prevState) => ({
                ...prevState,
                is2faSync: false,
            }))
            return;
        }
        snackBar('😥 해제중 오류가 발생했습니다.');
    }

    return (
        <>
            <>
                <div className="mb-5">
                    <Text fontSize={6} fontWeight={600}>
                        가입일
                    </Text>
                    <Text>{props.createdDate}</Text>
                </div>
                <div className="mb-5">
                    <div className="d-flex justify-content-between mb-2">
                        <Text fontSize={6} fontWeight={600}>
                            사용자 이름
                        </Text>
                        {isChangeUsername ? (
                            <div>
                                <Button gap="little" onClick={() => onChangeUsername()}>
                                    업데이트
                                </Button>
                                <Button onClick={() => {
                                    setChangeUsername(false);
                                    setUsername(props.username);
                                }}>
                                    취소
                                </Button>
                            </div>
                        ) : (
                            <Button onClick={() => setChangeUsername(true)}>
                                변경
                            </Button>
                        )}
                    </div>
                    <div className="mb-2">
                        {isChangeUsername ? (
                            <input
                                type="text"
                                placeholder="아이디"
                                className="form-control"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                            />
                        ) : (
                            <Text>{username}</Text>
                        )}
                    </div>
                    <Alert type="warning">
                        {`https://blex.me/@${username}`}
                    </Alert>
                </div>
                <div className="mb-5">
                    <div className="d-flex justify-content-between mb-2">
                        <Text fontSize={6} fontWeight={600}>
                            이메일
                        </Text>
                    </div>
                    <Text>{props.email}</Text>
                </div>
                <div className="mb-5">
                    <div className="d-flex justify-content-between mb-2">
                        <Text fontSize={6} fontWeight={600}>
                            기타 정보
                        </Text>
                        <Button onClick={() => onSubmit()}>
                            업데이트
                        </Button>
                    </div>
                    <input
                        type="text"
                        value={realname}
                        placeholder="사용자 실명"
                        className="form-control mb-2"
                        maxLength={30}
                        onChange={(e) => setRealname(e.target.value)}
                    />
                    <input
                        type="password"
                        value={password}
                        placeholder="새 비밀번호"
                        className="form-control mb-2"
                        maxLength={200}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    <input
                        type="password"
                        value={passwordCheck}
                        placeholder="비밀번호 확인"
                        className="form-control mb-2"
                        maxLength={200}
                        onChange={(e) => setPasswordCheck(e.target.value)}
                    />
                    <CheckBox
                        label="회원에게 이메일을 노출합니다."
                        defaultChecked={showEmail}
                        onClick={(value: boolean) => setShowEmail(value)}
                    />
                    <CheckBox
                        label="이메일 전송에 동의합니다."
                        defaultChecked={agreeEmail}
                        onClick={(value: boolean) => setAgreeEmail(value)}
                    />
                    <CheckBox
                        label="활동 내역 수집에 동의합니다."
                        defaultChecked={agreeHistory}
                        onClick={(value: boolean) => setAgreeHistory(value)}
                    />
                </div>
                {is2faSync ? (
                    <Button gap="little" onClick={() => confirm('😥 정말 2차 인증을 해제할까요?') ? onDeleteTwoFactorAuth() : ''}>
                        2차 인증 중지
                    </Button>
                ) : (
                    <Button gap="little" onClick={() => modalStore.onOpenModal('isTwoFactorAuthSyncModalOpen')}>
                        2차 인증 등록
                    </Button>
                )}
                <Button onClick={() => modalStore.onOpenModal('isSignoutModalOpen')}>
                    회원 탈퇴
                </Button>
            </>
        </>
    );
}

AccountSetting.pageLayout = (page: JSX.Element) => (
    <Layout tabname="account">
        {page}
    </Layout>
)