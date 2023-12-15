import {
    useEffect,
    useState
} from 'react';
import type { GetServerSideProps } from 'next';

import { authorRenameCheck } from '~/modules/middleware/author';

import {
    FeaturedArticles,
    ProfileLayout,
    RecentActivity
} from '@system-design/profile';
import {
    Heatmap,
    SEO
} from '@system-design/shared';
import type { PageComponent } from '~/components';
import { Text } from '~/components/design-system';

import * as API from '~/modules/api';

import { configStore } from '~/stores/config';

type Props = API.GetUserProfileResponseData;

export const getServerSideProps: GetServerSideProps = async (context) => {
    const { author = '' } = context.query as Record<string, string>;

    if (!author.startsWith('@')) {
        return { notFound: true };
    }

    try {
        const { data } = await API.getUserProfile(author, [
            'profile',
            'social',
            'heatmap',
            'most',
            'recent'
        ]);
        return { props: { ...data.body } };
    } catch (error) {
        return await authorRenameCheck(error, { author });
    }
};

const Overview: PageComponent<Props> = (props) => {
    const [isNightMode, setIsNightMode] = useState(configStore.state.theme === 'dark');

    useEffect(() => {
        const updateKey = configStore.subscribe((state) => {
            setIsNightMode(state.theme === 'dark');
        });

        return () => configStore.unsubscribe(updateKey);
    }, []);

    return (
        <>
            <SEO
                title={`${props.profile.username} (${props.profile.name})`}
                image={props.profile.image}
                description={props.profile.bio}
            />

            <div className="x-container">
                <Text className="mt-5" fontWeight={700} fontSize={8}>
                    인기 컨텐츠
                </Text>
                <FeaturedArticles articles={props.most || []} />
                <Text className="mt-5" fontWeight={700} fontSize={8}>
                    최근 활동
                </Text>
                <Heatmap
                    isNightMode={isNightMode}
                    data={props.heatmap}
                />
                <RecentActivity items={props.recent || []} />
            </div>
        </>
    );
};

Overview.pageLayout = (page, props) => (
    <ProfileLayout
        active="overview"
        profile={props.profile}
        social={props.social}>
        {page}
    </ProfileLayout>
);

export default Overview;
