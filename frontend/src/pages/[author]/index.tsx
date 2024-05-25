import {
    useEffect,
    useState
} from 'react';
import type { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import { useValue } from 'badland-react';

import { type DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';

import { authorRenameCheck } from '~/modules/middleware/author';

import {
    BaseInput, Button, Card, Checkbox, Flex, Grid, Label, Modal, SortableItem, Text, VerticalSortable
} from '~/components/design-system';

import {
    Heatmap,
    SEO
} from '~/components/system-design/shared';
import {
    ProfileLayout,
    RecentActivity
} from '~/components/system-design/profile';
import { ArticleContent } from '~/components/system-design/article-detail-page';
import { CapsuleArticleCard } from '~/components/system-design/article';
import type { PageComponent } from '~/components';

import { useDebounceValue } from '~/hooks/use-debounce-value';
import { useFetch } from '~/hooks/use-fetch';

import { lazyLoadResource } from '~/modules/optimize/lazy';

import { authStore } from '~/stores/auth';
import { configStore } from '~/stores/config';

import * as API from '~/modules/api';

interface Props extends API.GetUserProfileResponseData {
    preview: '' | 'about';
}

export const getServerSideProps: GetServerSideProps = async (context) => {
    const { author = '', preview = '' } = context.query as Record<string, string>;

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
        return {
            props: {
                ...data.body,
                preview
            }
        };
    } catch (error) {
        return await authorRenameCheck(error, { author });
    }
};

const Overview: PageComponent<Props> = (props) => {
    const router = useRouter();

    const [username] = useValue(authStore, 'username');
    const [isNightMode, setIsNightMode] = useState(configStore.state.theme === 'dark');
    const [isOpenPostsPinModal, setIsOpenPostsPinModal] = useState(false);

    useEffect(() => {
        lazyLoadResource();

        const updateKey = configStore.subscribe((state) => {
            setIsNightMode(state.theme === 'dark');
        });

        return () => configStore.unsubscribe(updateKey);
    }, []);

    const { data: pinnedPosts, mutate: setPinnedPosts } = useFetch('pinned-posts', async () => {
        const { data } = await API.getPinnedPosts();
        return data.body?.length ? data.body : [];
    }, { enable: username === props.profile.username });

    const [pinnablePostSearch, setPinnablePostSearch] = useState('');
    const [pinnablePostPage, setPinnablePostPage] = useState(1);

    const debouncedValues = useDebounceValue([
        pinnablePostPage,
        pinnablePostSearch
    ] as const, 200);

    const { data: pinnablePostsData } = useFetch(['pinnable-posts', ...debouncedValues], async () => {
        const { data } = await API.getPinnablePosts({
            page: debouncedValues[0],
            search: debouncedValues[1]
        });
        return data.body;
    }, { enable: username === props.profile.username });

    const handleSelectPost = (post: API.GetPinnablePostsResponseData['posts'][number]) => {
        setPinnedPosts((prev) => {
            if (prev.some(p => p.url === post.url)) {
                return prev.filter(p => p.url !== post.url);
            } else {
                return [...prev, {
                    ...post,
                    order: prev.length + 1
                }];
            }
        });
    };

    const checkedPinnablePost = (url: string) => {
        return pinnedPosts?.some(post => post.url === url);
    };

    const handleSocialDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (over) {
            if (active.id === over.id) return;

            setPinnedPosts((prev) => {
                const oldIndex = prev.findIndex((item) => item.url === active.id);
                const newIndex = prev.findIndex((item) => item.url === over.id);
                const next = arrayMove(prev, oldIndex, newIndex);
                return next;
            });
        }
    };

    const handleSubmitPinnedPost = async () => {
        const { data } = await API.createPinnedPosts({ posts: pinnedPosts?.map(post => post.url).join(',') || '' });
        if (data.status === 'DONE') {
            router.reload();
        }
    };

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

            {!props.about && props.preview === 'about' && username === props.profile.username && (
                <Card className="mb-7 p-4">
                    <Flex direction="column" gap={3}>
                        여기에 소개 문구가 추가됩니다.
                        <Button onClick={() => router.push(`@${props.profile.username}/about/edit`)}>소개를 작성해 볼까요?</Button>
                    </Flex>
                </Card>
            )}

            {props.most!.length > 0 && (
                <div className="mb-7">
                    <Flex align="center" justify="between">
                        <Text fontWeight={700} fontSize={6}>
                            대표 포스트
                        </Text>
                        {username === props.profile.username && (
                            <Button onClick={() => setIsOpenPostsPinModal(true)}>
                                포스트 고정
                            </Button>
                        )}
                    </Flex>
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

            {username === props.profile.username && (
                <Modal
                    isOpen={isOpenPostsPinModal}
                    onClose={() => setIsOpenPostsPinModal(false)}
                    onSubmit={handleSubmitPinnedPost}
                    title="포스트 고정"
                    submitText="저장하기">
                    {pinnedPosts && pinnablePostsData?.posts && (
                        <Flex direction="column" gap={3}>
                            <Text fontSize={3} fontWeight={600}>고정된 포스트</Text>
                            <Card className="p-3">
                                <Flex direction="column" gap={3}>
                                    <VerticalSortable
                                        items={pinnedPosts.map(post => post.url)}
                                        onDragEnd={handleSocialDragEnd}>
                                        {pinnedPosts.map((post) => (
                                            <SortableItem
                                                key={post.url}
                                                id={post.url}
                                                className="w-100"
                                                render={({ listeners }) => (
                                                    <Flex className="w-100" align="center" gap={2}>
                                                        <div
                                                            {...listeners}
                                                            className="px-2"
                                                            style={{
                                                                cursor: 'grab',
                                                                touchAction: 'none'
                                                            }}>
                                                            <Text fontSize={3}>
                                                                <i className="fas fa-bars" />
                                                            </Text>
                                                        </div>
                                                        <Flex
                                                            style={{ flex: 1 }}
                                                            align="center"
                                                            justify="between">
                                                            <Text fontSize={3}>{post.title}</Text>
                                                            <Text className="gray-dark" fontSize={2}>
                                                                <Flex align="center" gap={1}>
                                                                    <i className="fas fa-heart"></i>
                                                                    {post.countLikes}
                                                                </Flex>
                                                            </Text>
                                                        </Flex>
                                                    </Flex>
                                                )}
                                            />
                                        ))}
                                    </VerticalSortable>
                                </Flex>
                            </Card>
                            <Text fontSize={3} fontWeight={600}>고정 가능한 포스트</Text>
                            <Card className="p-3">
                                <div className="mb-3">
                                    <Label>포스트 필터</Label>
                                    <BaseInput
                                        tag="input"
                                        value={pinnablePostSearch}
                                        placeholder="검색어를 입력하세요."
                                        onChange={(e) => {
                                            setPinnablePostPage(1);
                                            setPinnablePostSearch(e.target.value);
                                        }}
                                    />
                                </div>
                                {pinnablePostsData.posts.map((post) => (
                                    <Flex key={post.url} className="w-100" align="center" justify="between">
                                        <Checkbox
                                            label={post.title}
                                            disabled={
                                                !checkedPinnablePost(post.url) &&
                                                pinnedPosts.length > 5
                                            }
                                            checked={checkedPinnablePost(post.url)}
                                            onChange={() => handleSelectPost(post)}
                                        />
                                        <Text className="gray-dark" fontSize={2}>
                                            <Flex align="center" gap={1}>
                                                <i className="fas fa-heart"></i>
                                                {post.countLikes}
                                            </Flex>
                                        </Text>
                                    </Flex>
                                ))}
                                <Flex className="my-3" align="center" justify="center" gap={2}>
                                    <Button
                                        disabled={pinnablePostPage <= 1}
                                        onClick={() => setPinnablePostPage(prev => prev - 1)}>
                                        이전
                                    </Button>
                                    {pinnablePostPage} of {pinnablePostsData.lastPage}
                                    <Button
                                        disabled={pinnablePostPage >= pinnablePostsData.lastPage}
                                        onClick={() => setPinnablePostPage(prev => prev + 1)}>
                                        다음
                                    </Button>
                                </Flex>
                            </Card>
                        </Flex>
                    )}
                </Modal >
            )}
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
