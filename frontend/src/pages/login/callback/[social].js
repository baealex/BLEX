import React from 'react';
import Router from 'next/router';

import { toast } from 'react-toastify';

import FullLoading from '@components/common/FullLoading';

import * as API from '@modules/api';
import Global from '@modules/global';
import Cookie from '@modules/cookie';

export async function getServerSideProps(context) {
    let { social, code } = context.query;
    return { props: { social, code } };
}

class SocialLogin extends React.Component {
    constructor(props) {
        super(props);
    }

    async onSocialLogin(social, code) {
        const { data } = await API.socialLogin(social, code);
        this.loginCheck(data);
    }

    async loginCheck(data) {
        if(data.status == 'DONE') {
            toast(`😃 로그인 되었습니다.`);

            if(data.notifyCount != 0) {
                toast(`😲 읽지 않은 알림이 ${data.notifyCount}개 있습니다.`, {
                    onClick:() => {
                        Router.push('/setting');
                    }
                });
            }

            Global.setState({
                isLogin: true,
                username: data.username
            });
        } else if(data.status == 'ready') {
            toast('😃 2차 인증 코드를 입력해 주세요.');
            Global.onOpenModal('isTwoFactorAuthModalOpen');
        } else {
            toast('😥 인증이 실패했습니다.');
        }
    }

    componentDidMount() {
        const {
            social,
            code
        } = this.props;

        if(!social || !code) {
            return;
        }

        setTimeout(() => {
            this.onSocialLogin(social, code);
        }, 500);
        
        const oauthRedirect = Cookie.get('oauth_redirect');
        oauthRedirect ? Router.replace(oauthRedirect) : Router.replace('/');
    }

    render() {
        return (
            <>
                <FullLoading/>
            </>
        )
    }
}

export default SocialLogin;