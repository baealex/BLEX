import React from 'react';
import Router from 'next/router';

import Footer from '@components/common/Footer';
import Config from '@modules/config.json';

import { toast } from 'react-toastify';
import HCaptcha from '@hcaptcha/react-hcaptcha';

import { GetServerSidePropsContext } from 'next';

import * as API from '@modules/api';

export async function getServerSideProps(context: GetServerSidePropsContext) {
    const { token } = context.query;
    
    try {
        const { data } = await API.getEmailVerify(token as string);
        return {
            props: {
                token,
                username: data.body.firstName
            }
        }
    } catch(error) {
        return {
            notFound: true
        };
    }
}

interface Props {
    token: string;
    username: string;
}

export default function Verify(props: Props) {
    const onSubmit = async (hctoken?: string) => {
        if(Config.HCAPTCHA_SITE_KEY) {
            if(!hctoken) {
                toast('😅 체크박스를 눌러주세요!');
                return;
            }
        }
        const { data } = await API.postEmailVerify(props.token, hctoken);
        if (data.status === 'ERROR') {
            if (data.errorCode === API.ERROR.ALREADY_VERIFY) {
                toast('😥 이미 인증된 메일입니다.');
            }
            if (data.errorCode === API.ERROR.EXPIRE) {
                toast('😥 만료된 토큰입니다.');
            }
            if (data.errorCode === API.ERROR.REJECT) {
                toast('😥 인증이 실패했습니다.');
            }
        }
        if(data.status === 'DONE') {
            toast(`😆 ${props.username}님! 환영합니다 🎉`);
            if(data.body.notifyCount != 0) {
                toast(`😲 읽지 않은 알림이 ${data.body.notifyCount}개 있습니다.`, {
                    onClick:() => {
                        Router.push('/setting');
                    }
                });
            }
            Router.replace('/');
        }
        return;
    }

    return (
        <>
            <div className="text-center display-center">
                <div className="h5 noto mb-4">{props.username}님이 맞으십니까?</div>
                {Config.HCAPTCHA_SITE_KEY ? (
                    <HCaptcha
                        sitekey={Config.HCAPTCHA_SITE_KEY}
                        onVerify={(token) => onSubmit(token)}
                    />
                ) : (
                    <button className="active-button noto" onClick={() => onSubmit()}>
                        이메일 인증 완료
                    </button>
                )}
            </div>
            <Footer/>
        </>
    );
}