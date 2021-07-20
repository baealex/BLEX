import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

import { ArticleList } from '@components/article';
import {
    Alert,
    Footer,
    Pagination,
    SearchBox
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

    useEffect(() => {
        API.getSearch(props.query, props.page).then(({data}) => {
            setResponse(data);
            lazyLoadResource();
        })
        setSearch(props.query);
    }, [props.page, props.query]);

    const handleClickSearch = () => {
        if (search != props.query) {
            router.push('/search?q=' + search);
        }
    }

    return (
        <>
            <>
                <Head>
                    <title>'{props.query}' 검색 결과</title>
                </Head>

                <div className="container">
                    <div className="row justify-content-center">
                        <div className="col-lg-8">
                            <div className="mb-3">
                                <SearchBox
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    onClick={handleClickSearch}
                                    placeholder="검색어를 입력하세요."
                                    buttonText="Search"
                                />
                            </div>
                            {response?.status == 'ERROR' ? (
                                <Alert>
                                    {response.errorMessage}
                                </Alert>
                            ) : (
                                <>
                                    <div className="mb-3 shallow-dark">
                                        {response?.body.totalSize}건의 결과 ({response?.body.elapsedTime}초)
                                    </div>
                                    {response?.body.results.map((item, idx) => (
                                        <ArticleList key={idx} {...item}/>
                                    ))}
                                    <Pagination
                                        page={props.page}
                                        last={response?.body.lastPage || 0}
                                    />
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