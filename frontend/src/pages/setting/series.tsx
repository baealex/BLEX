import React, { useState } from 'react';
import type { GetServerSideProps } from 'next';
import Link from 'next/link';

import { Button, Card } from '@design-system';
import type { PageComponent } from '~/components';
import { SettingLayout } from '@system-design/setting';

import * as API from '~/modules/api';
import { message } from '~/modules/utility/message';
import { snackBar } from '~/modules/ui/snack-bar';

import { loadingStore } from '~/stores/loading';

type Props = API.GetSettingSeriesResponseData;

export const getServerSideProps: GetServerSideProps<Props> = async ({ req }) => {
    const { data } = await API.getSettingSeries({ 'Cookie': req.headers.cookie || '' });

    if (data.status === 'ERROR') {
        return {
            redirect: {
                destination: '/',
                permanent: false
            }
        };
    }
    return { props: data.body };
};

const SeriesSetting: PageComponent<Props> = (props) => {
    const [newSeries, setNewSeries] = useState('');
    const [series, setSeries] = useState(props.series);

    const handleCreate = async () => {
        if (!newSeries) {
            snackBar(message('BEFORE_REQ_ERR', '시리즈의 이름을 입력하세요.'));
            return;
        }
        const { data } = await API.postUserSeries('@' + props.username, newSeries);
        snackBar(message('AFTER_REQ_DONE', '시리즈가 생성되었습니다.'));
        setSeries((prevSeries) => [{
            url: data.body.url,
            title: newSeries,
            totalPosts: 0
        }].concat(prevSeries));
        setNewSeries('');
    };

    const handleDelete = async (url: string) => {
        if (confirm(message('CONFIRM', '정말 이 시리즈를 삭제할까요?'))) {
            const { data } = await API.deleteUserSeries('@' + props.username, url);
            if (data.status === 'DONE') {
                setSeries((prevSeries) => prevSeries
                    .filter(series => series.url !== url));
                snackBar(message('AFTER_REQ_DONE', '시리즈가 삭제되었습니다.'));
            }
        }
    };

    const handleChangeOrder = async (url: string, prevIdx: number, nextIdx: number) => {
        if (nextIdx < 0 || nextIdx > series.length - 1) return;

        loadingStore.start();

        const nextOrders = series.map((item, idx) => {
            if (item.url === url) {
                return [item.url, nextIdx];
            }

            if (nextIdx === idx) {
                return [item.url, prevIdx];
            }

            return [item.url, idx];
        });

        const { data } = await API.putUserSeriesOrder('@' + props.username, nextOrders);
        setSeries(data.body.series);

        loadingStore.end();
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        handleCreate();
    };

    return (
        <>
            <form onSubmit={handleSubmit} className="input-group mb-3">
                <input
                    type="text"
                    placeholder="시리즈의 이름"
                    className="form-control"
                    maxLength={50}
                    onChange={(e) => setNewSeries(e.target.value)}
                    value={newSeries}
                />
                <div className="input-group-prepend">
                    <Button type="submit">
                        새 시리즈 만들기
                    </Button>
                </div>
            </form>
            {series.map((item, idx) => (
                <div key={item.url} className="d-flex mb-3">
                    <div className="d-flex flex-column justify-content-between mr-3">
                        <div className="c-pointer" onClick={() => handleChangeOrder(item.url, idx, idx - 1)}>
                            <i className="fas fa-angle-up"></i>
                        </div>
                        <div className="c-pointer" onClick={() => handleChangeOrder(item.url, idx, idx + 1)}>
                            <i className="fas fa-angle-down"></i>
                        </div>
                    </div>
                    <Card hasBackground isRounded className="p-3">
                        <div className="d-flex justify-content-between">
                            <Link className="deep-dark" href={`/@${props.username}/series/${item.url}`}>
                                {item.title} <span className="vs">{item.totalPosts}</span>
                            </Link>
                            <a onClick={() => handleDelete(item.url)}>
                                <i className="fas fa-times"></i>
                            </a>
                        </div>
                    </Card>
                </div>
            ))}
        </>
    );
};

SeriesSetting.pageLayout = (page) => (
    <SettingLayout active="series">
        {page}
    </SettingLayout>
);

export default SeriesSetting;
