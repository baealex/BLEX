import { useEffect } from 'react';
import Router from 'next/router';

import { toast } from 'react-toastify';

import FullLoading from '@components/shared/FullLoading';

import * as API from '@modules/api';
import Global from '@modules/global';
import Cookie from '@modules/cookie';

import { GetServerSidePropsContext } from 'next';

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
                toast('😃 2차 인증 코드를 입력해 주세요.');
                Global.onOpenModal('isTwoFactorAuthModalOpen');
                return;
            }
            toast(`😃 로그인 되었습니다.`);
            if(data.body.notifyCount != 0) {
                toast(`😲 읽지 않은 알림이 ${data.body.notifyCount}개 있습니다.`, {
                    onClick:() => {
                        Router.push('/setting');
                    }
                });
            }

            Global.setState({
                isLogin: true,
                username: data.body.username
            });
        } else {
            toast('😥 인증이 실패했습니다.');
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

        setTimeout(() => {
            onSocialLogin(social, code);
        }, 500);
        
        const oauthRedirect = Cookie.get('oauth_redirect');
        oauthRedirect
            ? Router.replace(oauthRedirect)
            : Router.replace('/');
    }, []);

    return <FullLoading/>;
}