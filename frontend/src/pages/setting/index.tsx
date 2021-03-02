import React, { useState } from 'react';
import Link from 'next/link';

import { toast } from 'react-toastify';

import Modal from '@components/modal/Modal';
import ModalContent from '@components/modal/Content';
import SettingLayout from '@components/setting/layout';

import * as API from '@modules/api';

import { GetServerSidePropsContext } from 'next';

interface Props extends API.SettingNotifyData {}

export async function getServerSideProps(context: GetServerSidePropsContext) {
    const { req, res } = context;
    if(!req.headers.cookie) {
        res.writeHead(302, { Location: '/' });
        res.end();
    }
    const { data } = await API.getSetting(req.headers.cookie, 'notify');
    if(data === API.ERROR.NOT_LOGIN) {
        res.writeHead(302, { Location: '/' });
        res.end();
    }
    return {
        props: data
    };
}

export default function Setting(props: Props) {
    const [ isSync, setSync ] = useState(props.isTelegramSync);
    const [ isModalOpen, setModalOpen ] = useState(false);
    const [ notify, setNotify ] = useState(props.notify);
    const [ telegramToken, setTelegramToken ] = useState('');

    const makeToken = async () => {
        setModalOpen(true);
        if(!telegramToken) {
            const { data } = await API.telegram('makeToken');
            setTelegramToken(data);
        }
    };

    const unsync = async () => {
        if(confirm('😥 정말 연동을 해제할까요?')) {
            const { data } = await API.telegram('unsync');
            if(data == 'DONE') {
                toast('😀 텔레그램과 연동이 해제되었습니다.');
                setSync(false);
            }
        }
    }

    const onReadNotify = async (pk: number) => {
        const { data } = await API.putSetting('notify', { pk: pk });
        if(data == 'DONE') {
            setNotify(notify.map(item => {
                return item.pk == pk ? {
                    ...item,
                    isRead: true
                } : item;
            }));
        }
    }

    return (
        <>
            <SettingLayout tabname="notify">
                <>
                    {isSync ? (
                        <div className="p-3 btn-primary c-pointer" onClick={() => unsync()}>
                            <i className="fab fa-telegram-plane"></i> 텔레그램과 연동을 해제할까요?
                        </div>
                    ) : (
                        <div className="p-3 btn-primary c-pointer" onClick={() => makeToken()}>
                            <i className="fab fa-telegram-plane"></i> 텔레그램으로 실시간 알림받기
                        </div>
                    )}
                    {notify.length == 0 ? (
                        <div className="blex-card p-3 mt-3">
                            최근 생성된 알림이 없습니다.
                        </div>
                    ) : notify.map((item, idx) => (
                        <Link key={idx} href={item.url}>
                            <a className={item.isRead ? 'shallow-dark' : 'deep-dark'} onClick={() => onReadNotify(item.pk)}>
                                <div className="blex-card p-3 mt-3">{item.content} <span className="ns shallow-dark">{item.createdDate}전</span></div>
                            </a>
                        </Link>
                    ))}
                </>
            </SettingLayout>
            <Modal title="텔레그램 연동" isOpen={isModalOpen} close={() => setModalOpen(false)}>
                <ModalContent>
                    <>
                        텔레그램과 연동하면 어떤 효과가 있나요?
                        <ul>
                            <li>실시간으로 회원님의 알림을 전달해 드립니다.</li>
                            <li>로그인시 2차 인증을 사용할 수 있습니다.</li>
                        </ul>
                        어떻게 연동하나요?
                        <ul>
                            <li>텔레그램을 실행하시고 <a href="http://t.me/blex_bot" className="shallow-dark">@blex_bot</a>을 추가해주세요!</li>
                            <li>봇에게 <code>{telegramToken}</code>라고 말해주세요!</li>
                        </ul>
                        해당 토큰은 회원님을 위해 생성된 일회성 토큰이며 연동을 완료되거나 오늘이 지나면 파기됩니다.
                    </>
                </ModalContent>
            </Modal>
        </>
    );
}