import React, { useState } from 'react';
import type { GetServerSideProps } from 'next';
import Link from 'next/link';

import { arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DragEndEvent } from '@dnd-kit/core';

import { Button, Card, Flex, VerticalSortable } from '@design-system';
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

function SeriesItem(props: {
    username: string;
    url: string;
    title: string;
    totalPosts: number;
    onClickDelete: () => void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
        id: props.url
    });

    return (
        <div
            ref={setNodeRef}
            {...attributes}
            style={{
                transform: CSS.Translate.toString(transform),
                transition
            }}
            className="mb-3">
            <Flex>
                <Flex align="center" justify="center">
                    <div
                        {...listeners}
                        className="p-3"
                        style={{
                            cursor: 'grab',
                            touchAction: 'none'
                        }}>
                        <i className="fas fa-bars" />
                    </div>
                </Flex>
                <Card hasBackground isRounded className="p-3">
                    <Flex justify="between">
                        <Link className="deep-dark" href={`/@${props.username}/series/${props.url}`}>
                            {props.title} <span className="vs">{props.totalPosts}</span>
                        </Link>
                        <a onClick={props.onClickDelete}>
                            <i className="fas fa-times" />
                        </a>
                    </Flex>
                </Card>
            </Flex>
        </div>
    );
}

const SeriesSetting: PageComponent<Props> = (props) => {
    const [newSeries, setNewSeries] = useState('');
    const [series, setSeries] = useState(props.series);

    const handleCreate = async () => {
        if (!newSeries) {
            snackBar(message('BEFORE_REQ_ERR', '시리즈의 이름을 입력해주세요.'));
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
                setSeries((prevSeries) => prevSeries.filter(series => series.url !== url));
                snackBar(message('AFTER_REQ_DONE', '시리즈가 삭제되었습니다.'));
            }
        }
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (over) {
            if (active.id === over.id) return;

            loadingStore.start();

            setSeries((prevSeries) => {
                const oldIndex = prevSeries.findIndex((item) => item.url === active.id);
                const newIndex = prevSeries.findIndex((item) => item.url === over.id);
                const nextSeries = arrayMove(prevSeries, oldIndex, newIndex);

                API.putUserSeriesOrder(
                    '@' + props.username,
                    nextSeries.map((item, idx) => [item.url, idx])
                ).finally(() => loadingStore.end());

                return nextSeries;
            });
        }
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
                    placeholder="시리즈 이름"
                    className="form-control"
                    maxLength={50}
                    onChange={(e) => setNewSeries(e.target.value)}
                    value={newSeries}
                />
                <div className="input-group-prepend">
                    <Button type="submit">
                        추가
                    </Button>
                </div>
            </form>
            <VerticalSortable items={series.map((item) => item.url)} onDragEnd={handleDragEnd}>
                {series.map((item) => (
                    <SeriesItem
                        key={item.url}
                        username={props.username}
                        {...item}
                        onClickDelete={() => handleDelete(item.url)}
                    />
                ))}
            </VerticalSortable>
        </>
    );
};

SeriesSetting.pageLayout = (page) => (
    <SettingLayout active="series">
        {page}
    </SettingLayout>
);

export default SeriesSetting;
