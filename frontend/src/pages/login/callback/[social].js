import React from 'react';
import Router from 'next/router';

import { toast } from 'react-toastify';

import API from '../../../modules/api';
import Global from '../../../modules/global';
import Cookie from '../../../modules/cookie';

export async function getServerSideProps(context) {
    let { social, code } = context.query;
    return { props: { social, code } };
}

class SocialLogin extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            username: Global.state.username,
        };
        Global.appendUpdater('SocialLogin', () => this.setState({
            ...this.state,
            username: Global.state.username,
        }));
    }

    async onSocialLogin(social, code) {
        const { data } = await API.socialLogin(social, code);
        this.loginCheck(data);
    }

    async loginCheck(data) {
        if(data.status == 'success') {
            const oauthRedirect = Cookie.get('oauth_redirect');
            oauthRedirect ? Router.replace(oauthRedirect) : Router.replace('/')

            toast(`😃 로그인 되었습니다.`);

            if(data.notify_count != 0) {
                toast(`😲 읽지 않은 알림이 ${data.notify_count}개 있습니다.`);
            }

            Global.setState({
                ...Global.state,
                isLogin: true,
                username: data.username
            });
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
        this.onSocialLogin(social, code);
    }

    render() {
        return (
            <>
                <div>Loading...</div>
            </>
        )
    }
}

export default SocialLogin;