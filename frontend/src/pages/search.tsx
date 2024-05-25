import React, { useEffect } from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';

import {
    Alert, Container, Flex, Loading, Text
} from '~/components/design-system';
import { ArticleCard, ArticleCardGroup } from '~/components/system-design/article';
import { Footer, Pagination, SearchBox } from '~/components/system-design/shared';

import { useFetch } from '~/hooks/use-fetch';

import * as API from '~/modules/api';

interface Props {
    page: number;
    query: string;
    username: string;
}

export const getServerSideProps: GetServerSideProps = async (context) => {
    const {
        u = '',
        q = '',
        page = 1
    } = context.query as {
        [key: string]: string;
    };

    return {
        props: {
            page: Number(page),
            query: q,
            username: u
        }
    };
};

export default function Search(props: Props) {
    const router = useRouter();

    const { data: response, isLoading } = useFetch([
        'search',
        props.query,
        props.page
    ], async () => {
        if (props.query) {
            const { data } = await API.getSearch(props.query, props.page, props.username);
            return data;
        }
    });

    const { data: history, mutate: setHistory } = useFetch('search/history', async () => {
        const { data } = await API.getSearchHistory();
        return data.body.searches;
    });

    const handleRemoveHistory = async (pk: number) => {
        const { data } = await API.deleteSearchHistory(pk);
        if (data.status === 'DONE') {
            API.getSearchHistory().then(({ data }) => {
                setHistory(data.body.searches);
            });
        }
    };

    useEffect(() => {
        API.getSearchHistory().then(({ data }) => {
            setHistory(data.body.searches);
        });
    }, [response]);

    return (
        <>
            <Head>
                {props.query ? (
                    <title>'{props.query}' 검색 결과</title>
                ) : (
                    <title>검색어를 입력하세요.</title>
                )}
                <meta name="robots" content="noindex" />
            </Head>

            <Container size="sm">
                <div className="mb-4">
                    <SearchBox
                        maxLength={20}
                        query={props.query}
                        placeholder="검색어를 입력하세요."
                        button={<i className="fas fa-search" />}
                        onClick={(value) => router.push(`/search?q=${value}&u=${props.username}`)}
                        history={history || undefined}
                        onClickHistory={(value) => router.push('/search?q=' + value)}
                        onRemoveHistory={handleRemoveHistory}
                    />
                </div>
                {isLoading && (
                    <Flex align="center" justify="center" className="mt-5">
                        <Loading position="inline" />
                    </Flex>
                )}
                {!isLoading && response?.status === 'ERROR' && (
                    <Alert>
                        {response.errorMessage}
                    </Alert>
                )}
                {!isLoading && response?.status === 'DONE' && !response?.body.results && (
                    <Alert>
                        검색 결과가 없습니다.
                    </Alert>
                )}
                {!isLoading && response?.status === 'DONE' && response?.body.results && (
                    <>
                        <Flex align="center" justify="between" wrap="wrap" gap={3}>
                            <Text className="shallow-dark">
                                <Flex align="center" gap={2}>
                                    <i className="fas fa-search" />
                                    '{props.query}{props.username && ` of @${props.username}`}' 검색
                                </Flex>
                            </Text>
                            <Text className="shallow-dark">
                                {response?.body.totalSize}개의 결과 ({response?.body.elapsedTime}초 소요)
                            </Text>
                        </Flex>
                        <ArticleCardGroup hasDivider className="mt-4 mb-5" gap={5}>
                            {response.body.results.map((item, idx) => (
                                <div key={idx}>
                                    <ArticleCard
                                        highlight={props.query}
                                        {...item}
                                    />
                                    <Flex className="mt-3" align="center" justify="end">
                                        <Text className="gray-dark" fontSize={3}>
                                            {item.positions.join(', ')}에서 검색됨
                                        </Text>
                                    </Flex>
                                </div>
                            ))}
                        </ArticleCardGroup>
                        {response.body.lastPage > 0 && (
                            <Pagination
                                page={props.page}
                                last={response?.body.lastPage}
                            />
                        )}
                    </>
                )}
            </Container>

            <Footer />
        </>
    );
}
