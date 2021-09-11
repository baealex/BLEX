import React, { useState } from 'react';
import { GetServerSidePropsContext } from 'next';
import Router from 'next/router';

import { toast } from 'react-toastify';

import {
    Button,
    CheckBox,
    Modal,
} from '@components/integrated';
import { Layout } from '@components/setting';

import * as API from '@modules/api';

import { authContext } from '@state/auth';

interface Props extends API.GetSettingAccountData {}

export async function getServerSideProps(context: GetServerSidePropsContext) {
    const { req, res } = context;
    if(!req.headers.cookie) {
        res.writeHead(302, { Location: '/' });
        res.end();
    }
    const { data } = await API.getSettingAcount(req.headers.cookie);
    if(data.status === 'ERROR') {
        res.writeHead(302, { Location: '/' });
        res.end();
    }
    return {
        props: data.body
    };
}

export default function AccountSetting(props: Props) {
    const [ isSignDeleteModalOpen, setSignDeleteModalOpen ] = useState(false);
    const [ isCreateTwoFactorAuthModalOpen, setCreateTwoFactorAuthModalOpen ] = useState(false);
    const [ isChangeUsername, setChangeUsername ] = useState(false);
    const [ username, setUsername ] = useState(props.username);
    const [ realname, setRealname ] = useState(props.realname);
    const [ password, setPassword ] = useState('');
    const [ hasTwoFactorAuth, setTwoFactorAuth ] = useState(props.hasTwoFactorAuth);
    const [ passwordCheck, setPasswordCheck ] = useState('');
    const [ agreeEmail, setAgreeEmail ] = useState(props.agreeEmail);
    const [ agreeHistory, setAgreeHistory ] = useState(props.agreeHistory);

    const onChangeUsername = async () => {
        const { data } = await API.putUsername(
            authContext.state.username,
            username
        );
        if (data.status === 'ERROR') {
            if (data.errorCode == API.ERROR.REJECT) {
                toast('😥 작성한 댓글과 포스트가 존재하여 변경할 수 없습니다.');
                setUsername(props.username);
                setChangeUsername(false);
                return;
            }
            if (data.errorCode == API.ERROR.ALREADY_EXISTS) {
                toast('😥 이미 존재하는 아이디입니다.');
                return;
            }
        }
        if (data.status === 'DONE') {
            toast('😀 아이디가 변경되었습니다.');
            authContext.setState((state) => ({
                ...state,
                username: username,
            }));
            setChangeUsername(false);
        }
    };

    const onSubmit = async () => {
        let sendData: any = {};
        if (!realname) {
            toast('🤔 이름은 비워둘 수 없습니다.');
            return;
        }

        if (props.realname != realname) {
            sendData.realname = realname;
        }

        if (password) {
            if (password != passwordCheck) {
                toast('🤔 입력한 패스워드가 서로 다릅니다.');
                return;
            }
            sendData.password = password;
        }

        sendData.agree_email = agreeEmail;
        sendData.agree_history = agreeHistory;

        const { data } = await API.putSetting('account', sendData);
        if (data.status === 'DONE') {
            toast('😀 계정이 업데이트 되었습니다.');
        }
        setPassword('');
        setPasswordCheck('');
    };

    const onSignOut = async () => {
        const { data } = await API.deleteSign();
        if (data.status === 'DONE') {
            authContext.initState();
            toast('😀 계정이 삭제되었습니다.');
            Router.push('/');
        }
    };

    const onCreateTwoFactorAuth = async () => {
        const { data } = await API.postSecurity();
        if (data.status === 'ERROR') {
            if (data.errorCode === API.ERROR.NOT_LOGIN) {
                toast('😥 로그인이 필요합니다.');
                return;
            }
            if (data.errorCode === API.ERROR.NEED_TELEGRAM) {
                toast('😥 텔레그램 연동이 필요합니다.', {
                    onClick: () => Router.push('/setting')
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
            setCreateTwoFactorAuthModalOpen(false);
            setTwoFactorAuth(true);
            return;
        }
        toast('😥 등록중 오류가 발생했습니다.');
    }

    const onDeleteTwoFactorAuth = async () => {
        const { data } = await API.deleteSecurity();
        if (data.status === 'ERROR') {
            if (data.errorCode == API.ERROR.ALREADY_UNSYNC) {
                toast('😥 이미 해제되어 있습니다.');
                return;
            }
            if (data.errorCode == API.ERROR.REJECT) {
                toast('😥 인증을 해제할 수 없습니다.');
                return;
            }
        }
        if (data.status === 'DONE') {
            toast('😀 2차 인증이 해제되었습니다.');
            setTwoFactorAuth(false);
            return;
        }
        toast('😥 해제중 오류가 발생했습니다.');
    }

    return (
        <>
            <>
                {isChangeUsername ? (
                    <div className="input-group mb-3">
                        <input
                            type="text"
                            placeholder="아이디"
                            className="form-control"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}/>
                        <div className="input-group-prepend">
                            <Button gap="little" onClick={() => onChangeUsername()}>
                                변경
                            </Button>
                            <Button onClick={() => {
                                setChangeUsername(false);
                                setUsername(props.username);
                            }}>
                                취소
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="d-flex justify-content-between">
                        <h3 className="font-weight-bold">
                            @{username}
                        </h3>
                        <Button onClick={() => setChangeUsername(true)}>
                            아이디 변경
                        </Button>
                    </div>
                )}
                <p>
                    {props.createdDate}
                </p>
                <input
                    type="text"
                    value={realname}
                    placeholder="이름"
                    className="form-control"
                    maxLength={30}
                    onChange={(e) => setRealname(e.target.value)}
                />
                <input
                    type="password"
                    value={password}
                    placeholder="새 비밀번호"
                    className="form-control"
                    maxLength={200}
                    onChange={(e) => setPassword(e.target.value)}
                />
                <input
                    type="password"
                    value={passwordCheck}
                    placeholder="비밀번호 확인"
                    className="form-control"
                    maxLength={200}
                    onChange={(e) => setPasswordCheck(e.target.value)}
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
                <Button gap="little" onClick={() => onSubmit()}>
                    정보 변경
                </Button>
                {hasTwoFactorAuth ? (
                    <Button gap="little" onClick={() => confirm('😥 정말 2차 인증을 해제할까요?') ? onDeleteTwoFactorAuth() : ''}>
                        2차 인증 중지
                    </Button>
                ) : (
                    <Button gap="little" onClick={() => setCreateTwoFactorAuthModalOpen(true)}>
                        2차 인증 등록
                    </Button>
                )}
                <Button onClick={() => setSignDeleteModalOpen(true)}>
                    회원 탈퇴
                </Button>
            </>
            <Modal
                title="정말 탈퇴 하시겠습니까?"
                isOpen={isSignDeleteModalOpen}
                onClose={() => setSignDeleteModalOpen(false)}
                submitText="네 탈퇴하겠습니다."
                onSubmit={() => onSignOut()}
            >
                유저님의 회원정보와 작성한 모든 데이터가 즉시 삭제되며 이 작업은 되돌릴 수 없습니다.
            </Modal>

            <Modal
                title="2차 인증을 사용할까요?"
                isOpen={isCreateTwoFactorAuthModalOpen}
                onClose={() => setCreateTwoFactorAuthModalOpen(false)}
                submitText="네 사용하겠습니다."
                onSubmit={() => onCreateTwoFactorAuth()}
            >
                <>
                    다음과 같은 요구사항이 필요합니다.
                    <ul>
                        <li>
                            계정에 등록된 이메일이 유효해야 합니다.
                            등록된 이메일로 복구키를 전송하며
                            복구키는 핸드폰을 소지하지 않았거나
                            기술적인 문제로 인증코드가 전달되지 않았을 때
                            사용할 수 있습니다.
                        </li>
                        <li>
                            텔레그램 연동이 필요합니다.
                            별도의 어플리케이션이 존재하지 않으므로
                            텔레그램을 활용하고 있으며
                            텔레그램은 '알림'탭에서 연동할 수 있습니다.
                        </li>
                    </ul>
                    연동 후 최소 하루동안 유지해야 하므로 신중하게 연동하여 주십시오.
                </>
            </Modal>
        </>
    );
}

AccountSetting.pageLayout = (page: JSX.Element) => (
    <Layout tabname="account">
        {page}
    </Layout>
)