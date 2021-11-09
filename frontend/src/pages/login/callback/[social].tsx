import { useEffect } from 'react';
import Router from 'next/router';
import { GetServerSidePropsContext } from 'next';

import { Loading } from '@components/integrated';

import { snackBar } from '@modules/snack-bar';
import * as API from '@modules/api';
import Cookie from '@modules/cookie';

import { authContext } from '@state/auth';
import { modalContext } from '@state/modal';

export async function getServerSideProps(context: GetServerSidePropsContext) {
    const {
        social,
        code
    } = context.query;
    
    return {
        props: {
            social,
            code
        }
    };
}

interface Props {
    social: string;
    code: string;
}

export default function SocialLogin(props: Props) {
    const onSocialLogin = async (social: string, code: string) => {
        const { data } = await API.postSignSocialLogin(social, code);
        
        if (data.status === 'DONE') {
            if (data.body.security) {
                snackBar('😃 2차 인증 코드를 입력해 주세요.');
                modalContext.onOpenModal('isTwoFactorAuthModalOpen');
                return;
            }
            snackBar(`😃 로그인 되었습니다.`);

            authContext.setState({
                isLogin: true,
                ...data.body
            });
        } else {
            snackBar('😥 인증이 실패했습니다.');
        }
    }

    useEffect(() => {
        const {
            social,
            code
        } = props;

        if(!social || !code) {
            return;
        }

        onSocialLogin(social, code).then(() => {
            const oauthRedirect = Cookie.get('oauth_redirect');
            oauthRedirect
                ? Router.replace(oauthRedirect)
                : Router.replace('/');  
        });
    }, []);

    return <Loading block/>;
}