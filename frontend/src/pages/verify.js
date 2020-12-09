import React from 'react';
import Head from 'next/head';
import Router from 'next/router';

import Footer from '@components/common/Footer';
import Config from '@modules/config.json';

import { toast } from 'react-toastify';

import API from '@modules/api';

export async function getServerSideProps(context) {
    const raise = require('@modules/raise');

    const { token } = context.query;
    
    try {
        const { data } = await API.getVerifyToken(token);
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

class Verify extends React.Component {
    constructor(props) {
        super(props);
    }

    componentDidMount() {
        if(Config.GOOGLE_RECAPTCHA_V2_KEY) {
            grecaptcha.render('google-recaptcha-v2', {
                sitekey: Config.GOOGLE_RECAPTCHA_V2_KEY,
            });
        }
    }

    async onSubmit() {
        if(Config.GOOGLE_RECAPTCHA_V2_KEY) {
            const recaptchaToken = grecaptcha.getResponse();
            if(!recaptchaToken) {
                toast('😅 체크박스를 눌러주세요!');
                return;
            }
            const { data } = await API.postVerifyToken(this.props.token, recaptchaToken);
            if(data == 'DONE') {
                Router.replace('/');
            }
            return;
        }
        const { data } = await API.postVerifyToken(this.props.token);
        if(data == 'DONE') {
            Router.replace('/');
        }
        return;
    }

    render() {
        return (
            <>
                <Head>
                    <title>BLOG EXPRESS ME</title>
                    <script src="https://www.google.com/recaptcha/api.js?onload=onloadCallback&render=explicit" async defer/>
                </Head>
                
                <div class="text-center display-center">
                    {Config.GOOGLE_RECAPTCHA_V2_KEY ? (
                        <div className="h5 serif mb-4">{this.props.username}님은 로봇이 아닙니까?</div>
                    ) : (
                        <div className="h5 serif mb-4">{this.props.username}님이 맞으십니까?</div>
                    )}
                    {Config.GOOGLE_RECAPTCHA_V2_KEY ? (
                        <p>
                            <div id="google-recaptcha-v2"></div>
                            <style jsx>{`
                                div {
                                    display: inline-block;
                                }
                            `}</style>
                        </p>
                     ) : ''}
                    <button className="active-button noto" onClick={() => this.onSubmit()}>
                        이메일 인증 완료
                    </button>
                </div>
                <Footer/>
            </>
        )
    }
}

export default Verify;