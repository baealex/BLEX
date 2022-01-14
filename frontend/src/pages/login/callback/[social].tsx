import { useEffect } from 'react';
import Router from 'next/router';
import { GetServerSidePropsContext } from 'next';

import { Loading } from '@design-system';

import * as API from '@modules/api';
import { snackBar } from '@modules/ui/snack-bar';
import { getCookie } from '@modules/utility/cookie';
import { message } from '@modules/utility/message';

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
                snackBar(message('AFTER_REQ_DONE', '2차 인증 코드를 입력해 주세요.'));
                modalContext.onOpenModal('isTwoFactorAuthModalOpen');
                return;
            }
            snackBar(message('AFTER_REQ_DONE', '로그인 되었습니다.'));

            authContext.setState({
                isLogin: true,
                ...data.body
            });
        } else {
            snackBar(message('AFTER_REQ_ERR', '소셜 인증을 실패했습니다.'));
        }
    }

    useEffect(() => {
        const { social, code } = props;

        if (!social || !code) {
            return;
        }

        onSocialLogin(social, code).then(() => {
            const oauthRedirect = getCookie('oauth_redirect');
            oauthRedirect
                ? Router.replace(oauthRedirect)
                : Router.replace('/');  
        });
    }, []);

    return <Loading block/>;
}