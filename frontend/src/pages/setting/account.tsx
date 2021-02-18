import React, { useState } from 'react';
import Router from 'next/router'

import { toast } from 'react-toastify';

import Modal from '@components/modal/Modal';
import ModalButton from '@components/modal/Button';
import ModalContent from '@components/modal/Content';
import SettingLayout from '@components/setting/layout';

import * as API from '@modules/api';
import Global from '@modules/global';

import { GetServerSidePropsContext } from 'next';

interface Props extends API.SettingAccountData {}

export async function getServerSideProps(context: GetServerSidePropsContext) {
    const { req, res } = context;
    if(!req.headers.cookie) {
        res.writeHead(302, { Location: '/' });
        res.end();
    }
    const { data } = await API.getSetting(req.headers.cookie, 'account');
    if(data === API.ERROR.NOT_LOGIN) {
        res.writeHead(302, { Location: '/' });
        res.end();
    }
    return {
        props: data
    };
}

export default function Setting(props: Props) {
    const [ isModalOpen, setModalOpen ] = useState(false);
    const [ isChangeUsername, setChangeUsername ] = useState(false);
    const [ username, setUsername ] = useState(props.username);
    const [ realname, setRealname ] = useState(props.realname);
    const [ password, setPassword ] = useState('');
    const [ passwordCheck, setPasswordCheck ] = useState('');

    const onChangeUsername = async () => {
        const { data } = await API.putUsername(
            Global.state.username,
            username
        );
        if(data == API.ERROR.REJECT) {
            toast('😥 작성한 댓글과 포스트가 존재하여 변경할 수 없습니다.');
            setUsername(props.username);
            setChangeUsername(false);
            return;
        }
        if(data == API.ERROR.ALREADY_EXISTS) {
            toast('😥 이미 존재하는 아이디입니다.');
            return;
        }
        if(data == 'DONE') {
            toast('😀 아이디가 변경되었습니다.');
            Global.setState({
                username: username
            });
            setChangeUsername(false);
        }
    };

    const onSubmit = async () => {
        let sendData: any = {};
        if(!realname) {
            toast('🤔 이름은 비워둘 수 없습니다.');
            return;
        }

        if(props.realname != realname) {
            sendData.realname = realname;
        }

        if(password) {
            if(password != passwordCheck) {
                toast('🤔 입력한 패스워드가 서로 다릅니다.');
                return;
            }
            sendData.password = password;
        }

        const { data } = await API.putSetting('account', sendData);
        if(data == 'DONE') {
            toast('😀 계정이 업데이트 되었습니다.');
        }
        setPassword('');
        setPasswordCheck('');
    };

    const onSignOut = async () => {
        const { data } = await API.signDelete();
        if(data == 'DONE') {
            Global.setState({
                isLogin: false
            });
            toast('😀 계정이 삭제되었습니다.');
            Router.push('/');
        }
    };

    return (
        <>
            <SettingLayout tabname="account">
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
                                <button
                                    type="button"
                                    className="btn btn-dark"
                                    onClick={() => onChangeUsername()}>
                                    변경
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-dark"
                                    onClick={() => {
                                        setChangeUsername(false);
                                        setUsername(props.username);
                                    }}>
                                    취소
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="d-flex justify-content-between">
                            <h3 className="noto font-weight-bold">
                                @{username}
                            </h3>
                            <button
                                type="button"
                                className="btn btn-dark"
                                onClick={() => setChangeUsername(true)}>
                                아이디 변경
                            </button>
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
                    <button
                        type="button"
                        className="btn btn-dark"
                        onClick={() => onSubmit()}>정보 변경
                    </button>
                    <button
                        type="button"
                        className="btn btn-dark"
                        onClick={() => setModalOpen(true)}>회원 탈퇴
                    </button>
                    <style jsx>{`
                        input {
                            margin-bottom: 15px;
                        }
                        button {
                            margin-right: 5px;
                        }
                    `}</style>
                </>
            </SettingLayout>
            <Modal title="정말 탈퇴 하시겠습니까?" isOpen={isModalOpen} close={() => setModalOpen(false)}>
                <ModalContent>
                    <>
                        유저님의 회원정보와 작성한 모든 데이터가 즉시 삭제되며 이 작업은 되돌릴 수 없습니다.
                    </>
                </ModalContent>
                <ModalButton text="네 탈퇴하겠습니다." onClick={() => onSignOut()}/>
            </Modal>
        </>
    );
}