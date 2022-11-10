import {
    useEffect,
    useState
} from 'react';
import type { GetServerSideProps } from 'next';

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

import * as API from '~/modules/api';

import { configStore } from '~/stores/config';

export const getServerSideProps: GetServerSideProps = async (context) => {
    const { author = '' } = context.query;

    if (!author.includes('@')) {
        return { notFound: true };
    }

    try {
        const { data } = await API.getUserProfile(author as string, [
            'profile',
            'social',
            'heatmap',
            'most',
            'recent'
        ]);
        return { props: { ...data.body } };
    } catch (error) {
        return { notFound: true };
    }
};

type Props = API.GetUserProfileResponseData;

const Overview: PageComponent<Props> = (props) => {
    const [ isNightMode, setIsNightMode ] = useState(configStore.state.theme === 'dark');

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
                <FeaturedArticles articles={props.most || []}/>
                <Heatmap
                    isNightMode={isNightMode}
                    data={props.heatmap}
                />
                <RecentActivity data={props.recent || []}/>
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
