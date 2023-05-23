import type { GetServerSideProps } from 'next';
import Link from 'next/link';
import React from 'react';
import { useRouter } from 'next/router';

import {
    Card
} from '@design-system';
import type { PageComponent } from '~/components';
import { Pagination } from '@system-design/shared';
import { SettingLayout } from '@system-design/setting';

import * as API from '~/modules/api';
import { message } from '~/modules/utility/message';
import { snackBar } from '~/modules/ui/snack-bar';

interface Props extends API.GetSettingDraftPostsResponseData {
    page: number;
}

export const getServerSideProps: GetServerSideProps = async ({ req, query }) => {
    const { page = 1 } = query;

    const { data } = await API.getSettingDraftPosts(
        { page: Number(page) },
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
    const router = useRouter();

    const onDelete = async (token: string) => {
        if (confirm(message('CONFIRM', '정말 이 임시 포스트를 삭제할까요?'))) {
            const { data } = await API.deleteTempPosts(token);
            if (data.status === 'DONE') {
                router.replace(router.asPath, '', { scroll: false });
                snackBar(message('AFTER_REQ_DONE', '임시 포스트가 삭제되었습니다.'));
            }
        }
    };

    return (
        <>
            {props.posts.map((post, idx) => (
                <Card key={idx} isRounded hasBackground className="mb-4">
                    <div className="p-3">
                        <div className="d-flex justify-content-between mb-1">
                            <span>
                                <Link className="deep-dark" href={`/write?token=${post.token}`}>
                                    {post.title}
                                </Link>
                            </span>
                            <a onClick={() => onDelete(post.token)}>
                                <i className="fas fa-times"></i>
                            </a>
                        </div>
                        <div className="mb-1">
                            <time className="post-date shallow-dark">
                                {post.createdDate}
                                {post.createdDate !== post.updatedDate && ` (Updated: ${post.updatedDate})`}
                            </time>
                        </div>
                    </div>
                </Card>
            ))}
            <Pagination
                page={props.page}
                last={props.lastPage}
            />
        </>
    );
};

PostsSetting.pageLayout = (page) => (
    <SettingLayout active="posts/draft">
        {page}
    </SettingLayout>
);

export default PostsSetting;
