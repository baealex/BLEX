import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { GetServerSidePropsContext } from 'next';

import { Layout } from '@components/profile';
import { ArticleContent } from '@components/article';
import { Alert } from '@components/atoms';

import { snackBar } from '@modules/snack-bar';

import * as API from '@modules/api'
import blexer from '@modules/blexer';

import { authContext } from '@state/auth';
import { SEO } from '@components/shared';

export async function getServerSideProps(context: GetServerSidePropsContext) {
    const {
        author = ''
    } = context.query;

    try {
        if(!author.includes('@')) {
            throw 'invalid author';
        }

        const userProfile = await API.getUserProfile(author as string, [
            'profile',
            'social',
            'about'
        ]);

        return {
            props: userProfile.data.body
        }
    } catch(error) {
        return {
            notFound: true
        };
    }
}

interface Props extends API.GetUserProfileData {}

export default function UserAbout(props: Props) {
    const [ isEdit, setIsEdit ] = useState(false);
    const [ aboutHTML, setAboutHTML ] = useState(props.about);
    const [ aboutMd, setAboutMd ] = useState<string | undefined>(undefined);
    const [ username, setUsername ] = useState(authContext.state.username);

    useEffect(() => {
        const updateKey = authContext.append((state) => {
            setUsername(state.username);
        });

        return () => authContext.pop(updateKey);
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
                snackBar('😄 정상적으로 변경되었습니다.');
            }
        }
        setIsEdit(!isEdit);
    };

    return (
        <>
            <Head>
                <title>{props.profile.username} ({props.profile.realname}) —  About</title>
            </Head>
            <SEO
                title={`${props.profile.username} (${props.profile.realname}) —  About`}
                image={props.profile.image}
                description={props.profile.bio}
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
                            <Alert>
                                아직 작성된 소개가 없습니다.
                            </Alert>
                        )
                    )}
                    {props.profile.username == username ? (
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

UserAbout.pageLayout = (page: JSX.Element, props: Props) => (
    <Layout
        active="about"
        profile={props.profile}
        social={props.social!}
    >
        {page}
    </Layout>
)