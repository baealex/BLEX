import React, {
    useEffect,
    useState
} from 'react';
import type { GetServerSideProps } from 'next';

import { Button, Text } from '@design-system';
import { ArticleContent } from '@system-design/article-detail-page';
import type { PageComponent } from '~/components';
import { ProfileLayout } from '@system-design/profile';
import { SEO } from '@system-design/shared';

import * as API from '~/modules/api';

import { authStore } from '~/stores/auth';
import { useRouter } from 'next/router';

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
    const router = useRouter();
    const [ username, setUsername ] = useState(authStore.state.username);

    useEffect(() => {
        const updateKey = authStore.subscribe((state) => {
            setUsername(state.username);
        });

        return () => authStore.unsubscribe(updateKey);
    }, []);

    return (
        <>
            <SEO
                title={`${props.profile.username} (${props.profile.name}) — About`}
                image={props.profile.image}
                description={props.profile.bio}
            />
            <div className="x-container mt-4">
                {(props.about || '').length <= 0 ? (
                    <div className="d-flex justify-content-center align-items-center flex-column py-5">
                        <img className="w-100" src="/illustrators/doll-play.svg" />
                        <Text className="mt-5" fontSize={6}>
                            아직 작성된 소개가 없습니다.
                        </Text>
                    </div>
                ) : (
                    <ArticleContent html={props.about || ''} />
                )}
                {props.profile.username == username && (
                    <Button
                        display="block"
                        space="spare"
                        onClick={() => router.push(router.asPath + '/edit')}>
                        {(props.about || '').length <= 0
                            ? '프로필 소개를 작성해 볼까요?'
                            : '프로필 소개 업데이트'}
                    </Button>
                )}
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
