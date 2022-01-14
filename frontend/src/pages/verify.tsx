import React from 'react';
import Router from 'next/router';

import { Footer } from '@components/shared';

import { snackBar } from '@modules/ui/snack-bar';
import HCaptcha from '@hcaptcha/react-hcaptcha';

import { GetServerSidePropsContext } from 'next';

import * as API from '@modules/api';
import { CONFIG } from '@modules/settings';
import { authContext } from '@state/auth';

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
        if(CONFIG.HCAPTCHA_SITE_KEY) {
            if(!hctoken) {
                snackBar('😅 체크박스를 눌러주세요!');
                return;
            }
        }
        const { data } = await API.postEmailVerify(props.token, hctoken);
        if (data.status === 'ERROR') {
            if (data.errorCode === API.ERROR.ALREADY_VERIFY) {
                snackBar('😥 이미 인증된 메일입니다.');
            }
            if (data.errorCode === API.ERROR.EXPIRE) {
                snackBar('😥 만료된 토큰입니다.');
            }
            if (data.errorCode === API.ERROR.REJECT) {
                snackBar('😥 인증이 실패했습니다.');
            }
        }
        if(data.status === 'DONE') {
            snackBar(`😆 ${props.username}님! 환영합니다 🎉`);
            authContext.setState({
                isLogin: true,
                ...data.body,
            })
            Router.replace('/');
        }
        return;
    }

    return (
        <>
            <div className="text-center display-center">
                <div className="h5 mb-4">{props.username}님이 맞으십니까?</div>
                {CONFIG.HCAPTCHA_SITE_KEY ? (
                    <HCaptcha
                        sitekey={CONFIG.HCAPTCHA_SITE_KEY}
                        onVerify={(token) => onSubmit(token)}
                    />
                ) : (
                    <button className="active-button" onClick={() => onSubmit()}>
                        이메일 인증 완료
                    </button>
                )}
            </div>
            <Footer/>
        </>
    );
}