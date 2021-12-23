import React, { useState } from 'react';
import Link from 'next/link';
import { GetServerSidePropsContext } from 'next';

import { Card } from '@components/atoms';
import { Layout } from '@components/setting';

import * as API from '@modules/api';
import { loadingContext } from '@state/loading';
import { snackBar } from '@modules/snack-bar';

interface Props extends API.GetSettingSeriesData {}

export async function getServerSideProps(context: GetServerSidePropsContext) {
    const { req, res } = context;
    if(!req.headers.cookie) {
        res.writeHead(302, { Location: '/' });
        res.end();
    }
    const { data } = await API.getSettingSeries(req.headers.cookie);
    if(data.status === 'ERROR') {
        res.writeHead(302, { Location: '/' });
        res.end();
    }
    return {
        props: data.body
    };
}

export default function SeriesSetting(props: Props) {
    const [ newSeries, setNewSeries ] = useState('');
    const [ series, setSeries ] = useState(props.series);

    const onSeriesCreate = async () => {
        if (!newSeries) {
            snackBar('😅 시리즈의 이름을 입력하세요.');
            return;
        }
        const { data } = await API.postUserSeries('@' + props.username, newSeries);
        snackBar('😀 시리즈가 생성되었습니다.');
        setSeries((prevSeries) => [{
            url: data.body.url,
            title: newSeries,
            totalPosts: 0
        }, ...prevSeries]);
        setNewSeries('');
    };

    const onSeriesDelete = async (url: string) => {
        if (confirm('😮 정말 이 시리즈를 삭제할까요?')) {
            const { data } = await API.deleteUserSeries('@' + props.username, url);
            if(data.status === 'DONE') {
                setSeries([...series.filter(series => (
                    series.url !== url
                ))]);
                snackBar('😀 시리즈가 삭제되었습니다.');
            }   
        }
    };

    const onSeriesChangeIndex = async (url: string, prevIdx: number, nextIdx: number) => {
        if (nextIdx < 0 || nextIdx > series.length - 1) return;
        
        loadingContext.start();

        const nextIndexies = series.map((item, idx) => {
            if (item.url === url) {
                return [item.url, nextIdx];
            }

            if (nextIdx === idx) {
                return [item.url, prevIdx];
            }

            return [item.url, idx]
        });

        const { data } = await API.putUserSeriesIndex('@' + props.username, nextIndexies);
        setSeries(data.body.series);

        loadingContext.end();
    }

    return (
        <>
            <div className="input-group mb-3">
                <input
                    type="text"
                    placeholder="시리즈의 이름"
                    className="form-control"
                    maxLength={50}
                    onChange={(e) => setNewSeries(e.target.value)}
                    value={newSeries}
                />
                <div className="input-group-prepend">
                    <button type="button" className="btn btn-dark" onClick={() => onSeriesCreate()}>새 시리즈 만들기</button>
                </div>
            </div>
            <>
                {series.map((item, idx) => (
                    <div key={idx} className="d-flex mb-3">
                        <div className="d-flex flex-column justify-content-between mr-3">
                            <div className="c-pointer" onClick={() => onSeriesChangeIndex(item.url, idx, idx-1)}>
                                <i className="fas fa-angle-up"></i>
                            </div>
                            <div className="c-pointer" onClick={() => onSeriesChangeIndex(item.url, idx, idx+1)}>
                                <i className="fas fa-angle-down"></i>
                            </div>
                        </div>
                        <Card hasShadow isRounded className="p-3">
                            <div className="d-flex justify-content-between">
                                <Link href="/[author]/series/[seriesurl]" as={`/@${props.username}/series/${item.url}`}>
                                    <a className="deep-dark">
                                        {item.title} <span className="vs">{item.totalPosts}</span>
                                    </a>
                                </Link>
                                <a onClick={() => onSeriesDelete(item.url)}>
                                    <i className="fas fa-times"></i>
                                </a>
                            </div>
                        </Card>
                    </div>
                ))}
            </>
        </>
    );
}

SeriesSetting.pageLayout = (page: JSX.Element) => (
    <Layout tabname="series">
        {page}
    </Layout>
)