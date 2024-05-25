import React, {
    useEffect,
    useState
} from 'react';
import type { GetServerSideProps } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/router';

import {
    Button,
    Card,
    DateInput,
    Dropdown,
    Flex,
    FormControl,
    Label
} from '~/components/design-system';
import type { PageComponent } from '~/components';
import { Pagination } from '~/components/system-design/shared';
import { SettingLayout } from '~/components/system-design/setting';

import * as API from '~/modules/api';
import { message } from '~/modules/utility/message';
import { snackBar } from '~/modules/ui/snack-bar';

interface Props extends API.GetSettingReservedPostsResponseData {
    page: number;
}

export const getServerSideProps: GetServerSideProps<Props> = async ({ req, query }) => {
    const { page = 1, order = '' } = query;

    const { data } = await API.getSettingReservedPosts(
        {
            order: String(order),
            page: Number(page)
        },
        { 'Cookie': req.headers.cookie || '' }
    );
    if (data.status === 'ERROR') {
        return {
            redirect: {
                destination: '/',
                permanent: false
            }
        };
    }
    return {
        props: {
            page: Number(page),
            ...data.body
        }
    };
};

const PostsSetting: PageComponent<Props> = (props) => {
    const [posts, setPosts] = useState(props.posts);

    useEffect(() => setPosts(props.posts), [props.posts]);

    const router = useRouter();

    const onPostsDelete = async (url: string) => {
        if (confirm(message('CONFIRM', '정말 이 포스트를 삭제할까요?'))) {
            const { data } = await API.deleteAnUserPosts('@' + props.username, url);
            if (data.status === 'DONE') {
                router.replace(router.asPath, '', { scroll: false });
                snackBar(message('AFTER_REQ_DONE', '포스트가 삭제되었습니다.'));
            }
        }
    };

    const onDateChange = (url: string, value: string) => {
        setPosts([...posts.map(post => (
            post.url == url ? ({
                ...post,
                createdDate: value
            }) : post
        ))]);
    };

    const handleSubmitDate = async (url: string) => {
        const thisPost = posts.find(post => post.url == url);
        if (!thisPost?.createdDate) {
            return snackBar(message('BEFORE_REQ_ERR', '예약 날짜를 입력해주세요.'));
        }
        if (thisPost?.createdDate < new Date().toISOString()) {
            return snackBar(message('BEFORE_REQ_ERR', '예약 날짜는 현재보다 과거일 수 없습니다.'));
        }
        const { data } = await API.putAnUserPosts('@' + props.username, url, 'reserved_date', { reserved_date: thisPost?.createdDate });
        if (data.status === 'DONE') {
            snackBar(message('AFTER_REQ_DONE', '발행 예약이 수정되었습니다.'));
        }
    };

    return (
        <>
            {posts.length === 0 && (
                <Card isRounded hasBackground className="mb-4 p-3">
                    예약된 포스트가 없습니다.
                </Card>
            )}
            {posts.map((post, idx) => (
                <Card key={idx} isRounded hasBackground className="mb-4">
                    <div className="p-3 mb-1">
                        <Flex justify="between" className="mb-1">
                            <span>
                                <Link className="deep-dark" href="/[author]/[posturl]" as={`/@${props.username}/${post.url}`}>
                                    {post.title}
                                </Link>
                            </span>
                            <Dropdown
                                button={
                                    <i className="fas fa-ellipsis-v"></i>
                                }
                                menus={[
                                    {
                                        name: '수정',
                                        onClick: () => router.push(`/@${props.username}/${post.url}/edit`)
                                    },
                                    {
                                        name: '삭제',
                                        onClick: () => onPostsDelete(post.url)
                                    }
                                ]}
                            />
                        </Flex>
                        <FormControl className="mt-2">
                            <Label>예약일</Label>
                            <Flex align="center" gap={2}>
                                <div style={{ flex: '1' }}>
                                    <DateInput
                                        showTime
                                        minDate={new Date()}
                                        selected={new Date(post.createdDate)}
                                        onChange={(date) => {
                                            if (date) {
                                                onDateChange(post.url, date.toISOString());
                                            }
                                        }}
                                    />
                                </div>
                                <Button onClick={() => handleSubmitDate(post.url)}>업데이트</Button>
                            </Flex>
                        </FormControl>
                    </div>
                </Card >
            ))}
            {
                posts.length > 0 && (
                    <Pagination
                        page={props.page}
                        last={props.lastPage}
                    />
                )
            }
        </>
    );
};

PostsSetting.pageLayout = (page) => (
    <SettingLayout active="posts/reserved">
        {page}
    </SettingLayout>
);

export default PostsSetting;
