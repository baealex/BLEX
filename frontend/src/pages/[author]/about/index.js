import React from 'react';
import Head from 'next/head';

import Profile from '@components/profile/Profile';
import ArticleContent from '@components/article/ArticleContent';
import PurpleBorder from '@components/common/PurpleBorder';

import { toast } from 'react-toastify';

import API from '@modules/api'
import Global from '@modules/global';
import blexer from '@modules/blexer';

export async function getServerSideProps(context) {
    const { author } = context.query;
    const { data } = await API.getUserProfile(author, [
        'profile',
        'social',
        'about'
    ]);
    return {
        props: {
            profile: data
        }
    }
}

class About extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            isEdit: false,
            aboutHTML: props.profile.about,
            aboutMD: undefined,
            isLogin: Global.state.isLogin,
            username: Global.state.username,
        }
        Global.appendUpdater('About', () => this.setState({
            ...this.state,
            isLogin: Global.state.isLogin,
            username: Global.state.username
        }));
    }

    onInputChange(e) {
        let newState = this.state;
        newState[e.target.name] = e.target.value;
        this.setState(newState);
    }

    async onClickEdit() {
        let newState = this.state;
        if(!newState.isEdit) {
            // 편집버튼 누른 상태
            if(newState.aboutMD == undefined) {
                const { data } = await API.getUserData('@' + this.state.username, 'profile', [
                    'about_md'
                ]);
                newState.aboutMD = data.aboutMd;
            }
        } else {
            // 완료버튼 누른 상태
            const aboutHTML = blexer(this.state.aboutMD)
            const { data } = await API.putAbout('@' + this.state.username, this.state.aboutMD, aboutHTML);
            if(data == 'DONE') {
                newState.aboutHTML = aboutHTML;
                toast('😄 정상적으로 변경되었습니다.');
            }
        }
        newState.isEdit = !newState.isEdit;
        this.setState(newState);
    }

    render() {
        return (
            <>
                <Head>
                    <title>{this.props.profile.profile.username} ({this.props.profile.profile.realname}) —  About</title>
                </Head>
                <Profile active="about" profile={this.props.profile.profile} social={this.props.profile.social}/>
                <div className="container">
                    <div className="col-lg-9 mx-auto p-0 my-4">
                        {this.state.isEdit ? (
                            <textarea
                                name="aboutMD"
                                cols="40"
                                rows="10"
                                placeholder="자신을 설명하세요."
                                className="form-control"
                                onChange={(e) => this.onInputChange(e)}
                                value={this.state.aboutMD}
                            />
                        ) : (
                            this.state.aboutHTML.length > 0 ? (
                                <ArticleContent html={this.state.aboutHTML}/>
                            ) : (
                                <PurpleBorder text="아직 작성된 소개가 없습니다."/>
                            )
                        )}
                        {this.props.profile.profile.username == this.state.username ? (
                            <button
                                className="btn btn-dark btn-block mt-3 edit"
                                onClick={() => this.onClickEdit()}>
                                {this.state.isEdit ? '완료' : '편집'}
                            </button>
                        ) : ''}
                    </div>
                </div>
            </>
        )
    }
}

export default About