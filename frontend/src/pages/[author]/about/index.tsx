import React, { useEffect, useState } from 'react';
import Head from 'next/head';

import Profile from '@components/profile/Profile';
import ArticleContent from '@components/article/ArticleContent';
import PurpleBorder from '@components/common/PurpleBorder';

import { toast } from 'react-toastify';

import * as API from '@modules/api'
import Global from '@modules/global';
import blexer from '@modules/blexer';

import { GetServerSidePropsContext } from 'next';

export async function getServerSideProps(context: GetServerSidePropsContext) {
    const {
        author = ''
    } = context.query;

    if(!author.includes('@')) {
        return {
            notFound: true
        };
    }

    try {
        const { data } = await API.getUserProfile(author as string, [
            'profile',
            'social',
            'about'
        ]);
        return {
            props: {
                profile: data.body
            }
        }
    } catch(error) {
        return {
            notFound: true
        };
    }
}

interface Props {
    profile: API.GetUserProfileData;
}

export default function UserAbout(props: Props) {
    const [ isEdit, setIsEdit ] = useState(false);
    const [ aboutHTML, setAboutHTML ] = useState(props.profile.about);
    const [ aboutMd, setAboutMd ] = useState<string | undefined>(undefined);
    const [ username, setUsername ] = useState(Global.state.username);

    useEffect(() => {
        Global.appendUpdater('UserAbout', () => {
            setUsername(Global.state.username);
        })

        return () => Global.popUpdater('UserAbout');
    }, []);

    const handleClickEdit = async () => {
        if (!isEdit) {
            // 편집버튼 누른 상태
            if(aboutMd === undefined) {
                const { data } = await API.getUserAbout('@' + username);
                setAboutMd(data.body.aboutMd);
            }
        } else {
            // 완료버튼 누른 상태
            const aboutMarkup = blexer(aboutMd);
            const { data } = await API.putUserAbout(
                '@' + username,
                aboutMd || '',
                aboutMarkup,
            );
            if (data.status === 'DONE') {
                setAboutHTML(aboutMarkup);
                toast('😄 정상적으로 변경되었습니다.');
            }
        }
        setIsEdit(!isEdit);
    };

    return (
        <>
            <Head>
                <title>{props.profile.profile.username} ({props.profile.profile.realname}) —  About</title>
            </Head>
            <Profile
                active="about"
                profile={props.profile.profile}
                social={props.profile.social!}
            />
            <div className="container">
                <div className="col-lg-9 mx-auto p-0 my-4">
                    {isEdit ? (
                        <textarea
                            cols={40}
                            rows={10}
                            placeholder="자신을 설명하세요."
                            className="form-control"
                            onChange={(e) => setAboutMd(e.target.value)}
                            value={aboutMd}
                        />
                    ) : (
                        (aboutHTML || '').length > 0 ? (
                            <ArticleContent html={aboutHTML || ''}/>
                        ) : (
                            <PurpleBorder text="아직 작성된 소개가 없습니다."/>
                        )
                    )}
                    {props.profile.profile.username == username ? (
                        <button
                            className="btn btn-dark btn-block mt-3 edit"
                            onClick={() => handleClickEdit()}>
                            {isEdit ? '완료' : '편집'}
                        </button>
                    ) : ''}
                </div>
            </div>
        </>
    )
}