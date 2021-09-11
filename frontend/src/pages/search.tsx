import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

import { ArticleCard } from '@components/article';
import { TagBadge } from '@components/tag';
import {
    Alert,
    Footer,
    Pagination,
    SearchBox,
} from '@components/integrated';

import * as API from '@modules/api';
import { lazyLoadResource } from '@modules/lazy';

import { GetServerSidePropsContext } from 'next';

export async function getServerSideProps(context: GetServerSidePropsContext) {
    const {
        q = '',
        page = 1,
    } = context.query;

    return {
        props: {
            query: q,
            page
        }
    }
}

interface Props {
    query: string;
    page: number;
}

export default function Search(props: Props) {
    const router = useRouter();

    const [ search, setSearch ] = useState(props.query);
    const [ response, setResponse ] = useState<API.ResponseData<API.GetSearchData>>();
    const [ history, setHistory ] = useState<API.GetSearchHistorySearch[]>([]);

    useEffect(() => {
        API.getSearchHistory().then(({data}) => {
            setHistory(data.body.searches);
        });
    }, []);

    useEffect(() => {
        if (props.query !== '') {
            API.getSearch(props.query, props.page).then(({data}) => {
                setResponse(data);
                lazyLoadResource();

                API.getSearchHistory().then(({data}) => {
                    setHistory(data.body.searches);
                });
            });
            setSearch(props.query);
        }
    }, [props.query]);

    useEffect(() => {
        if (props.query !== '') {
            API.getSearch(props.query, props.page).then(({data}) => {
                setResponse(data);
                lazyLoadResource();
            });
            setSearch(props.query);
        }
    }, [props.page]);

    const handleClickSearch = () => {
        if (search && search != props.query) {
            searching(search);
        }
    }

    const handleRemoveHistory = async (pk: number) => {
        const { data } = await API.deleteSearchHistory(pk);
        if (data.status === 'DONE') {
            API.getSearchHistory().then(({data}) => {
                setHistory(data.body.searches);
            });
        }
    }

    const searching = (keyword: string) => {
        router.push('/search?q=' + keyword);
    }

    return (
        <>
            <>
                <Head>
                    {props.query ? (
                        <title>'{props.query}' 검색 결과</title>
                    ) : (
                        <title>검색어를 입력하세요.</title>
                    )}
                    <meta name="robots" content="noindex"/>
                </Head>

                <div className="container">
                    <div className="row justify-content-center">
                        <div className="col-lg-8">
                            <div className="mb-4">
                                <SearchBox
                                    value={search}
                                    maxLength={10}
                                    placeholder="검색어를 입력하세요."
                                    onChange={(e) => setSearch(e.target.value)}
                                    button={<i className="fas fa-search"/>}
                                    onClick={handleClickSearch}
                                />
                                {history && (
                                    <div className="mt-3">
                                        <TagBadge disableSharp items={history.map(item => (
                                            <span className="mt-3">
                                                <a className="mr-2" onClick={() => searching(item.value)}>
                                                    {item.value}
                                                </a>
                                                <a onClick={() => handleRemoveHistory(item.pk)}>
                                                    <i className="fas fa-times"/>
                                                </a>
                                            </span>
                                        )) || []}/>
                                    </div>
                                )}
                            </div>
                            {response?.status == 'ERROR' ? (
                                <Alert>
                                    {response.errorMessage}
                                </Alert>
                            ) : (
                                <>
                                    {response?.body.results && (
                                        <>
                                            <div className="shallow-dark text-right">
                                                {response?.body.totalSize}건의 결과 ({response?.body.elapsedTime}초)
                                            </div>
                                            {response?.body.results.map((item, idx) => (
                                                <ArticleCard key={idx} className="mt-4" {...item}/>
                                            ))}
                                            {response?.body.lastPage ? (
                                                <Pagination
                                                    page={props.page}
                                                    last={response?.body.lastPage}
                                                />
                                            ) : ''}
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
                <Footer/>
            </>
        </>
    )
}