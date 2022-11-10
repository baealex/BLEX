import React, { useEffect } from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';

import {
    Footer,
    Pagination,
    SearchBox
} from '@system-design/shared';
import { Alert } from '@design-system';
import { ArticleCard } from '@system-design/article';

import * as API from '~/modules/api';
import { lazyLoadResource } from '~/modules/optimize/lazy';
import { useFetch } from '~/hooks/use-fetch';

export const getServerSideProps: GetServerSideProps = async (context) => {
    const {
        q = '',
        page = 1
    } = context.query;

    return {
        props: {
            query: q,
            page
        }
    };
};

interface Props {
    query: string;
    page: number;
}

export default function Search(props: Props) {
    const router = useRouter();

    const { data: response } = useFetch([
        'settings/analytics/search',
        props.query,
        props.page
    ], async () => {
        if (props.query) {
            const { data } = await API.getSearch(props.query, props.page);
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
        lazyLoadResource();
    }, [response]);

    return (
        <>
            <Head>
                {props.query ? (
                    <title>'{props.query}' 검색 결과</title>
                ) : (
                    <title>검색어를 입력하세요.</title>
                )}
                <meta name="robots" content="noindex"/>
            </Head>

            <div className="x-container">
                <div className="mb-4">
                    <SearchBox
                        maxLength={20}
                        placeholder="검색어를 입력하세요."
                        button={<i className="fas fa-search"/>}
                        onClick={(value) => router.push('/search?q=' + value)}
                        history={history || undefined}
                        onClickHistory={(value) => router.push('/search?q=' + value)}
                        onRemoveHistory={handleRemoveHistory}
                    />
                </div>
                {response?.status == 'ERROR' ? (
                    <Alert>
                        {response.errorMessage}
                    </Alert>
                ) : (
                    response?.body.results && (
                        <>
                            <div className="shallow-dark text-right">
                                {response?.body.totalSize}건의 결과 ({response?.body.elapsedTime}초)
                            </div>
                            {response?.body.results.map((item, idx) => (
                                <ArticleCard
                                    key={idx}
                                    className="mt-4"
                                    highlight={props.query}
                                    {...item}
                                />
                            ))}
                            {response?.body.lastPage && (
                                <Pagination
                                    page={props.page}
                                    last={response?.body.lastPage}
                                />
                            )}
                        </>
                    )
                )}
            </div>

            <Footer/>
        </>
    );
}
