import type { GetServerSideProps } from 'next';
import Link from 'next/link';

import {
    SpeechBubble,
    Text
} from '@design-system';

import {
    ArticleCard,
    CollectionLayout
} from '@system-design/article';
import {
    Pagination,
    SEO
} from '@system-design/shared';
import type { PageComponent } from '~/components';

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

const TagDetail: PageComponent<Props> = (props) => {
    return (
        <>
            <SEO
                title={`${props.tag}${props.page > 1 ? ` | ${props.page} 페이지` : ''}`}
                image="https://static.blex.me/assets/images/default-post.png"
                description={props.desc.url
                    ? props.desc.description
                    :`블렉스에서 '${props.tag}' 주제로 작성된 모든 포스트 만나보세요.`}
            />
            <Pagination
                page={props.page}
                last={props.lastPage}
            />
        </>
    );
};

TagDetail.pageLayout = (page, props) => (
    <CollectionLayout
        active={props.tag}
        itemExpended={(tags) => tags.concat({
            link: `/tags/${props.tag}`,
            name: props.tag
        })}
        {...props}>
        {props.desc.url && (
            <div className="mt-3">
                <SpeechBubble
                    href={`/@${props.desc.author}`}
                    alt={props.desc.author}
                    src={getUserImage(props.desc.authorImage)}>
                    {props.desc.description}
                    <Link href={`/@${props.desc.author}/${props.desc.url}`}>
                        <a className="ml-1 shallow-dark">
                            더보기
                        </a>
                    </Link>
                </SpeechBubble>
            </div>
        )}
        <div className="row">
            {props.posts.map(item => (
                <ArticleCard
                    key={item.url}
                    className="col-lg-4 col-md-6 mt-4"
                    {...item}
                />
            ))}
        </div>
        {page}
    </CollectionLayout>
);

export default TagDetail;
