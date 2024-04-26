import {
    useEffect,
    useState
} from 'react';
import type { GetServerSideProps } from 'next';

import { authorRenameCheck } from '~/modules/middleware/author';

import { Grid, Text } from '~/components/design-system';

import {
    Heatmap,
    SEO
} from '@system-design/shared';
import {
    ProfileLayout,
    RecentActivity
} from '@system-design/profile';
import { ArticleContent } from '~/components/system-design/article-detail-page';
import { CapsuleArticleCard } from '~/components/system-design/article';
import type { PageComponent } from '~/components';

import * as API from '~/modules/api';

import { configStore } from '~/stores/config';
import { lazyLoadResource } from '~/modules/optimize/lazy';

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
            'about',
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
        lazyLoadResource();

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

            {props.about && (
                <div className="mb-7">
                    <ArticleContent renderedContent={props.about} />
                </div>
            )}

            {props.most!.length > 0 && (
                <div className="mb-7">
                    <Text fontWeight={700} fontSize={6}>
                        인기 컨텐츠
                    </Text>
                    <div className="mt-3">
                        <Grid
                            gap={4}
                            column={{
                                desktop: 3,
                                tablet: 2,
                                mobile: 1
                            }}>
                            {props.most?.map((post, idx) => (
                                <CapsuleArticleCard key={idx} {...post} />
                            ))}
                        </Grid>
                    </div>
                </div>
            )}

            <Text fontWeight={700} fontSize={6}>
                최근 활동
            </Text>
            <div className="mt-3">
                <Heatmap
                    isNightMode={isNightMode}
                    data={props.heatmap}
                />
            </div>
            <RecentActivity items={props.recent || []} />
        </>
    );
};

Overview.pageLayout = (page, props) => (
    <ProfileLayout
        active="Overview"
        profile={props.profile}
        social={props.social}>
        {page}
    </ProfileLayout>
);

export default Overview;
