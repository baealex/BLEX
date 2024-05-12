import React, { useState } from 'react';
import type { GetServerSideProps } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useStore } from 'badland-react';

import { authorRenameCheck } from '~/modules/middleware/author';

import {
    BaseInput,
    Button,
    Card,
    Container,
    Flex,
    FormControl,
    Grid,
    Label,
    Loading,
    Modal,
    Text
} from '~/components/design-system';
import { Footer, SEO } from '~/components/system-design/shared';
import { SeriesArticleCard } from '~/components/system-design/series';

import { snackBar } from '~/modules/ui/snack-bar';

import { getUserImage } from '~/modules/utility/image';

import * as API from '~/modules/api';

import { authStore } from '~/stores/auth';
import { configStore } from '~/stores/config';

import { useForm } from '~/hooks/use-form';
import { useInfinityScroll } from '~/hooks/use-infinity-scroll';

interface Props {
    order: 'latest' | 'past';
    series: API.GetAnUserSeriesResponseData;
}

export const getServerSideProps: GetServerSideProps = async (context) => {
    const { cookies } = context.req;
    configStore.serverSideInject(cookies);

    const {
        order = 'latest',
        author = '',
        seriesurl = ''
    } = context.query as {
        [key: string]: string;
    };

    if (!author.startsWith('@')) {
        return { notFound: true };
    }

    try {
        const { data } = await API.getAnUserSeries(author, seriesurl, {
            page: 1,
            order: order as Props['order']
        });
        return {
            props: {
                order: order,
                series: data.body
            }
        };
    } catch (error) {
        return await authorRenameCheck(error, {
            author,
            continuePath: `/series/${encodeURI(seriesurl)}`
        });
    }
};

interface Form {
    title: string;
    description: string;
}

export default function Series(props: Props) {
    const router = useRouter();

    const [{ username }] = useStore(authStore);

    const [isOpenSeriesUpdateModal, setIsOpenSeriesUpdateModal] = useState(false);

    const { data: posts, mutate: setPosts, isLoading } = useInfinityScroll({
        key: ['series', props.series.url, props.order],
        callback: async (nextPage) => {
            const { data } = await API.getAnUserSeries(
                '@' + props.series.owner,
                props.series.url,
                {
                    page: nextPage,
                    order: props.order
                }
            );
            return data.body.posts;
        },
        initialValue: props.series.posts,
        lastPage: props.series.lastPage
    });

    const { register, handleSubmit } = useForm<Form>();

    const handleSeriesUpdate = handleSubmit(async (formData) => {
        const { data } = await API.putUserSeries('@' + props.series.owner, props.series.url, formData);

        if (data.status === 'DONE') {
            router.replace(`/@${username}/series/${data.body.url}`);
            setIsOpenSeriesUpdateModal(false);
            snackBar('😀 시리즈가 업데이트 되었습니다.');
        } else {
            snackBar('😯 변경중 오류가 발생했습니다.');
        }
    });

    const handleRemovePosts = async (url: string) => {
        if (confirm('😮 이 포스트를 시리즈에서 제거할까요?')) {
            const { data } = await API.putAnUserPosts('@' + props.series.owner, url, 'series');
            if (data.status === 'DONE') {
                setPosts((prevPosts) => prevPosts.filter(post => post.url !== url));
                snackBar('😀 시리즈가 업데이트 되었습니다.');
            } else {
                snackBar('😯 변경중 오류가 발생했습니다.');
            }
        }
    };

    const SeriesUpdateModal = () => (
        <Modal
            title="시리즈 수정"
            isOpen={isOpenSeriesUpdateModal}
            onClose={() => setIsOpenSeriesUpdateModal(false)}
            submitText="시리즈를 수정합니다"
            onSubmit={handleSeriesUpdate}>
            <Flex direction="column" gap={3}>
                <FormControl className="w-100" required>
                    <Label>
                        시리즈 이름
                    </Label>
                    <BaseInput
                        {...register('title')}
                        tag="input"
                        type="text"
                        placeholder="이 시리즈의 이름을 입력해주세요"
                        defaultValue={props.series.name}
                        maxLength={50}
                    />
                </FormControl>
                <FormControl className="w-100">
                    <Label>
                        시리즈 설명
                    </Label>
                    <BaseInput
                        {...register('description')}
                        tag="textarea"
                        type="text"
                        placeholder="이 시리즈에는 어떤 내용을 다루고 있나요?"
                        defaultValue={props.series.description}
                        maxLength={200}
                    />
                </FormControl>
            </Flex>
            {posts.map((post, idx) => (
                <Card key={post.url} className="p-3 mt-3">
                    <Flex justify="between">
                        <Text fontSize={3}>
                            {idx + 1}. {post.title}
                        </Text>
                        <a onClick={() => handleRemovePosts(post.url)}>
                            <i className="fas fa-times"></i>
                        </a>
                    </Flex>
                </Card>
            ))}
        </Modal>
    );

    return (
        <>
            <SEO
                title={`시리즈 - ${props.series.name} | ${props.series.owner}`}
                image={props.series.image}
            />

            {props.series.owner === username && (
                <SeriesUpdateModal />
            )}

            <div className="series-header">
                <Flex align="center" justify="center" style={{ minHeight: '280px' }}>
                    <Container size="sm">
                        <Text tag="h1" fontSize={6} fontWeight={600} className="mt-5 mb-2">
                            “{props.series.name}” 시리즈
                        </Text>
                        <Text>
                            {props.series.description}
                        </Text>
                    </Container>
                </Flex>
            </div>

            <Container>
                <Flex className="w-100 my-7" direction="column" align="center" gap={2}>
                    <Link href={`/@${props.series.owner}`}>
                        <img className="user-image" src={getUserImage(props.series.ownerImage)} alt={props.series.name} />
                    </Link>
                    <Link className="shallow-dark" href={`/@${props.series.owner}`}>
                        <Text fontSize={3}>Created by <span className="underline">@{props.series.owner}</span></Text>
                    </Link>
                </Flex>
            </Container>

            <Container>
                <Flex justify="end" className="mb-4" gap={1}>
                    {props.series.owner == username && (
                        <Button onClick={() => setIsOpenSeriesUpdateModal(true)}>
                            시리즈 수정
                        </Button>
                    )}
                    {props.order === 'latest' ? (
                        <Button
                            onClick={() => router.replace(`/@${props.series.owner}/series/${props.series.url}?order=past`, '', {
                                scroll: false
                            })}>
                            최신부터 <i className="fas fa-sort-amount-down"></i>
                        </Button>
                    ) : (
                        <Button
                            onClick={() => router.replace(`/@${props.series.owner}/series/${props.series.url}`, '', {
                                scroll: false
                            })}>
                            과거부터 <i className="fas fa-sort-amount-up"></i>
                        </Button>
                    )}
                </Flex>
                <Grid
                    gap={4}
                    column={{
                        desktop: 3,
                        tablet: 2,
                        mobile: 1
                    }}>
                    {posts.map((post) => (
                        <SeriesArticleCard
                            key={post.url}
                            author={props.series.owner}
                            {...post}
                        />
                    ))}
                </Grid>
                {isLoading && (
                    <Flex justify="center" className="pb-4">
                        <Loading position="inline" />
                    </Flex>
                )}
                <Container>
                    <Flex className="w-100 mt-7" direction="column" align="center" gap={3}>
                        <Link className="deep-dark" href={`/@${props.series.owner}/series`}>
                            <Button>이 에디터의 다른 시리즈 <i className="fas fa-angle-right ml-1" /></Button>
                        </Link>
                    </Flex>
                </Container>
            </Container>
            <Footer />

            <style jsx>{`
                :global(main.content) {
                    background-color: #F2F2F2;

                    :global(body.dark) & {
                        background-color: #151515;
                    }
                }

                .series-header {
                    margin: -100px 0 0;
                    background: #000;
                    position: relative;
                    padding: 64px 0 40px;
                    text-align: center;
                    color: #eee;
                }

                .series-header::after {
                    content: '';
                    position: absolute;
                    bottom: -28px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 0;
                    height: 0;
                    border-style: solid;
                    border-width: 30px 30px 0 30px;
                    border-color: #000 transparent transparent transparent;
                }

                .user-image {
                    width: 240px;
                    height: 240px;
                    border-radius: 50%;
                    object-fit: cover;
                }

                .underline {
                    text-decoration: underline;
                }                
            `}</style>
        </>
    );
}
