import type { GetServerSideProps } from 'next';
import Link from 'next/link';

import {
    Masonry,
    SpeechBubble,
    Text
} from '@design-system';

import {
    Footer,
    Pagination,
    SEO
} from '@system-design/shared';
import { ArticleCard } from '@system-design/article';

import * as API from '~/modules/api';
import { getUserImage } from '~/modules/utility/image';

export const getServerSideProps: GetServerSideProps = async (context) => {
    const {
        tag,
        page = 1
    } = context.query;

    try {
        const { data } = await API.getTag(String(tag), Number(page));
        return {
            props: {
                ...data.body,
                page
            }
        };
    } catch (error) {
        return { notFound: true };
    }
};

interface Props extends API.GetTagResponseData {
    page: number;
}

export default function TagDetail(props: Props) {
    return (
        <>
            <SEO
                title={`${props.tag}${props.page > 1 ? ` | ${props.page} 페이지` : ''}`}
                image="https://static.blex.me/assets/images/default-post.png"
                description={props.headPost
                    ? props.headPost.description
                    : `블렉스에서 '${props.tag}' 주제로 작성된 모든 포스트 만나보세요.`}
            />
            <div className="container">
                <Text fontSize={8} fontWeight={600}>— {props.tag} —</Text>
                {props.headPost && (
                    <div className="mt-3">
                        <SpeechBubble
                            href={`/@${props.headPost.author}`}
                            alt={props.headPost.author}
                            src={getUserImage(props.headPost.authorImage)}>
                            {props.headPost.description}
                            <Link className="ml-1 shallow-dark" href={`/@${props.headPost.author}/${props.headPost.url}`}>
                                더보기
                            </Link>
                        </SpeechBubble>
                    </div>
                )}
                <Masonry
                    items={props.posts.map((item, idx) => (
                        <ArticleCard
                            key={idx}
                            className="col-lg-4 col-md-6 mt-4"
                            {...item}
                        />
                    ))}
                />
                <Pagination
                    page={props.page}
                    last={props.lastPage}
                />
            </div >
            <Footer />
        </>
    );
}