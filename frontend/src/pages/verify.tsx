import React from 'react';
import Router from 'next/router';

import Footer from '@components/common/Footer';
import Config from '@modules/config.json';

import { toast } from 'react-toastify';
import HCaptcha from '@hcaptcha/react-hcaptcha';

import { GetServerSidePropsContext } from 'next';

import * as API from '@modules/api';

export async function getServerSideProps(context: GetServerSidePropsContext) {
    const raise = require('@modules/raise');

    const { token } = context.query;
    
    try {
        const { data } = await API.getVerifyToken(token as string);
        return {
            props: {
                token,
                username: data
            }
        }
    } catch(error) {
        raise.auto(error.response.status, context.res);
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
        const { data } = await API.postVerifyToken(props.token, hctoken);
        if(data == 'DONE') {
            toast('😆 이메일이 인증되었습니다.');
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