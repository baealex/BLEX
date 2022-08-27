import React, {
    useEffect,
    useState
} from 'react';
import type { GetServerSideProps } from 'next';

import { ArticleContent } from '@system-design/article-detail-page';
import type { PageComponent } from '~/components';
import { ProfileLayout } from '@system-design/profile';
import { SEO } from '@system-design/shared';
import { Text } from '@design-system';

import * as API from '~/modules/api';
import blexer from '~/modules/utility/blexer';
import { snackBar } from '~/modules/ui/snack-bar';

import { authStore } from '~/stores/auth';

export const getServerSideProps: GetServerSideProps = async (context) => {
    const { author = '' } = context.query;

    try {
        if (!author.includes('@')) {
            throw 'invalid author';
        }

        const userProfile = await API.getUserProfile(author as string, [
            'profile',
            'social',
            'about'
        ]);

        return { props: userProfile.data.body };
    } catch (error) {
        return { notFound: true };
    }
};

type Props = API.GetUserProfileResponseData;

const UserAbout: PageComponent<Props> = (props) => {
    const [ isEdit, setIsEdit ] = useState(false);
    const [ aboutHTML, setAboutHTML ] = useState(props.about);
    const [ aboutMd, setAboutMd ] = useState<string | undefined>(undefined);
    const [ username, setUsername ] = useState(authStore.state.username);

    useEffect(() => {
        const updateKey = authStore.subscribe((state) => {
            setUsername(state.username);
        });

        return () => authStore.unsubscribe(updateKey);
    }, []);

    const handleClickEdit = async () => {
        if (!isEdit) {
            // 편집버튼 누른 상태
            if (aboutMd === undefined) {
                const { data } = await API.getUserAbout('@' + username);
                setAboutMd(data.body.aboutMd);
            }
        } else {
            // 완료버튼 누른 상태
            const aboutMarkup = blexer(aboutMd);
            const { data } = await API.putUserAbout(
                '@' + username,
                aboutMd || '',
                aboutMarkup
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
            <SEO
                title={`${props.profile.username} (${props.profile.realname}) — About`}
                image={props.profile.image}
                description={props.profile.bio}
            />
            <div className="container">
                <div className="col-lg-8 mx-auto p-0 my-4">
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
                        (props.about || '').length <= 0 ? (
                            <div className="d-flex justify-content-center align-items-center flex-column py-5">
                                <img className="w-100" src="/illustrators/doll-play.svg" />
                                <Text className="mt-5" fontSize={6}>
                                    아직 작성된 소개가 없습니다.
                                </Text>
                            </div>
                        ) : (
                            <ArticleContent html={aboutHTML || ''} />
                        )
                    )}
                    {props.profile.username == username && (
                        <button
                            className="btn btn-dark btn-block mt-3 edit"
                            onClick={() => handleClickEdit()}>
                            {isEdit ? '완료' : '편집'}
                        </button>
                    )}
                </div>
            </div>
        </>
    );
};

UserAbout.pageLayout = (page, props) => (
    <ProfileLayout
        active="about"
        profile={props.profile}
        social={props.social}>
        {page}
    </ProfileLayout>
);

export default UserAbout;
