import React, { useState } from 'react';
import Link from 'next/link';

import { toast } from 'react-toastify';

import SettingLayout from '@components/setting/layout';

import * as API from '@modules/api';

import { GetServerSidePropsContext } from 'next';
import { Card } from '@components/atoms';

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

export default function Setting(props: Props) {
    const [ newSeries, setNewSeries ] = useState('');
    const [ series, setSeries ] = useState(props.series);

    const onSeriesCreate = async () => {
        if(!newSeries) {
            toast('😅 시리즈의 이름을 입력하세요.');
            return;
        }
        const { data } = await API.postUserSeries('@' + props.username, newSeries);
        toast('😀 시리즈가 생성되었습니다.');
        setSeries([{
            url: data.body.url,
            title: newSeries,
            totalPosts: 0
        }, ...series]);
    };

    const onSeriesDelete = async (url: string) => {
        if(confirm('😮 정말 이 시리즈를 삭제할까요?')) {
            const { data } = await API.deleteUserSeries('@' + props.username, url);
            if(data.status === 'DONE') {
                setSeries([...series.filter(series => (
                    series.url !== url
                ))]);
                toast('😀 시리즈가 삭제되었습니다.');
            }   
        }
    };

    return (
        <>
            <SettingLayout tabname="series">
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
                        <Card key={idx} isRounded className="p-3 mb-3">
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
                    ))}
                </>
            </SettingLayout>
        </>
    );
}