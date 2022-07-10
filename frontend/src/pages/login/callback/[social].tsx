import type { GetServerSideProps } from 'next';
import Router from 'next/router';
import { useEffect } from 'react';

import { Loading } from '@design-system';

import * as API from '@modules/api';
import { getCookie } from '@modules/utility/cookie';
import { message } from '@modules/utility/message';
import { snackBar } from '@modules/ui/snack-bar';

import { authStore } from '@stores/auth';
import { modalStore } from '@stores/modal';

export const getServerSideProps: GetServerSideProps = async (context) => {
    const { social, code } = context.query;

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
                modalStore.open('is2FAModalOpen');
                return;
            }

            if (data.body.isFirstLogin) {
                snackBar(message('AFTER_REQ_DONE', '소셜 회원가입을 환영합니다. 계정 관리에서 사용자 이름을 변경할 수 있습니다.'), { onClick: () => Router.push('/setting/account') });
            } else {
                snackBar(message('AFTER_REQ_DONE', '로그인 되었습니다.'));
            }

            authStore.set({
                isLogin: true,
                ...data.body
            });
        } else {
            snackBar(message('AFTER_REQ_ERR', '소셜 인증을 실패했습니다.'));
        }
    };

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

    return <Loading isFullPage />;
}