import type { GetServerSideProps } from 'next';
import React from 'react';
import Router from 'next/router';

import HCaptcha from '@hcaptcha/react-hcaptcha';

import { Footer } from '@system-design/shared';

import * as API from '~/modules/api';
import { CONFIG } from '~/modules/settings';
import { message } from '~/modules/utility/message';
import { snackBar } from '~/modules/ui/snack-bar';

import { authStore } from '~/stores/auth';

interface Props {
    token: string;
    username: string;
}

export const getServerSideProps: GetServerSideProps = async (context) => {
    const { token } = context.query as {
        [key: string]: string;
    };

    try {
        const { data } = await API.getEmailVerify(token as string);
        return {
            props: {
                token,
                username: data.body.firstName
            }
        };
    } catch (error) {
        return { notFound: true };
    }
};

export default function Verify(props: Props) {
    const onSubmit = async (hctoken?: string) => {
        if (CONFIG.HCAPTCHA_SITE_KEY) {
            if (!hctoken) {
                snackBar('😅 체크박스를 눌러주세요!');
                return;
            }
        }
        const { data } = await API.postEmailVerify(props.token, hctoken);
        if (data.status === 'ERROR') {
            if (data.errorCode === API.ERROR.ALREADY_VERIFICATION) {
                snackBar(message('AFTER_REQ_ERR', '이미 인증된 메일입니다.'));
            }
            if (data.errorCode === API.ERROR.EXPIRED) {
                snackBar(message('AFTER_REQ_ERR', '만료된 토큰입니다.'));
            }
            if (data.errorCode === API.ERROR.REJECT) {
                snackBar(message('AFTER_REQ_ERR', '인증이 실패하였습니다.'));
            }
        }
        if (data.status === 'DONE') {
            snackBar(`😆 ${props.username}님! 환영합니다 🎉`);
            authStore.set({
                isLogin: true,
                ...data.body
            });
            Router.replace('/');
        }
        return;
    };

    return (
        <>
            <div className="text-center display-center">
                <div className="h5 mb-4">
                    {props.username}님이 맞으십니까?
                </div>
                {CONFIG.HCAPTCHA_SITE_KEY ? (
                    <HCaptcha
                        sitekey={CONFIG.HCAPTCHA_SITE_KEY}
                        onVerify={onSubmit}
                    />
                ) : (
                    <button className="active-button" onClick={() => onSubmit()}>
                        이메일 인증 완료
                    </button>
                )}
            </div>
            <Footer />
        </>
    );
}