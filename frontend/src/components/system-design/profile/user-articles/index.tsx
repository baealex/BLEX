import { BaseInput, Flex } from '~/components/design-system';
import { useRef } from 'react';

import { ArticleCardGroup, ArticleCardList, ArticleCardListProps } from '../../article';

import { useRouter } from 'next/router';


const POSTS_ORDER = [
    {
        name: '제목 (ㄱ-ㅎ)',
        order: 'title'
    },
    {
        name: '제목 (ㅎ-ㄱ)',
        order: '-title'
    },
    {
        name: '작성일 (과거부터)',
        order: 'created_date'
    },
    {
        name: '작성일 (최신부터)',
        order: '-created_date'
    },
    {
        name: '수정일 (과거부터)',
        order: 'updated_date'
    },
    {
        name: '수정일 (최신부터)',
        order: '-updated_date'
    }
];

interface PostsProps {
    posts: ArticleCardListProps[];
    allCount: number;
    active: string;
    author: string;
    tags?: {
        name: string;
        count: number;
    }[];
    children?: JSX.Element;
}

export function UserArticles(props: PostsProps) {
    const router = useRouter();

    const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleChangeOrder = (e: React.ChangeEvent<HTMLSelectElement>) => {
        console.log(router.query);
        router.replace({
            pathname: router.pathname,
            query: {
                ...router.query,
                order: e.target.value
            }
        }, router.asPath, { scroll: false });
    };

    const handleChangeTagFilter = (e: React.ChangeEvent<HTMLSelectElement>) => {
        router.replace({
            pathname: router.pathname,
            query: {
                ...router.query,
                tag: e.target.value
            }
        }, router.asPath, { scroll: false });
    };

    const handleChangeSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (searchDebounce.current) {
            clearTimeout(searchDebounce.current);
        }

        searchDebounce.current = setTimeout(() => {
            router.replace({
                pathname: router.pathname,
                query: {
                    ...router.query,
                    search: e.target.value
                }
            }, router.asPath, { scroll: false });
        }, 300);
    };

    return (
        <>
            <Flex className="mb-3" justify="between" wrap="wrap" gap={2}>
                <div
                    style={{
                        flex: '1',
                        minWidth: '200px'
                    }}>
                    <BaseInput
                        tag="select"
                        icon={<i className="fas fa-sort" />}
                        defaultValue={router.query.order as string || '-created_date'}
                        onChange={handleChangeOrder}>
                        {POSTS_ORDER.map((order, idx) => (
                            <option key={idx} value={order.order}>{order.name}</option>
                        ))}
                    </BaseInput>
                </div>
                <div
                    style={{
                        flex: '1',
                        minWidth: '200px'
                    }}>
                    {props.tags && (
                        <BaseInput
                            tag="select"
                            icon={<i className="fas fa-tag" />}
                            value={router.query.tag as string || ''}
                            onChange={handleChangeTagFilter}>
                            <option value="">전체 포스트 ({props.allCount})</option>
                            {props.tags?.map((tag, idx) => (
                                <option key={idx} value={tag.name}>{tag.name} ({tag.count})</option>
                            ))}
                        </BaseInput>
                    )}
                </div>
            </Flex>
            <div className="mb-3">
                <BaseInput
                    tag="input"
                    icon={<i className="fas fa-search" />}
                    defaultValue={router.query.search as string || ''}
                    placeholder="검색어를 입력하세요."
                    onChange={handleChangeSearch}
                />
            </div>
            <div className="mt-5">
                <ArticleCardGroup hasDivider gap={5}>
                    {props.posts.map((item, idx) => (
                        <ArticleCardList key={idx} {...item} />
                    ))}
                    {props.children}
                </ArticleCardGroup>
            </div>
        </>
    );
}
