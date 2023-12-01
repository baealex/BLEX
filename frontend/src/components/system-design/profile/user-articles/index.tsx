import { useState } from 'react';

import { BaseInput, Button, Flex } from '~/components/design-system';

import { Articles, ArticlesProps } from './articles';
import { TagProps, Tags } from './tags';
import { useRouter } from 'next/router';

interface PostsProps {
    posts: ArticlesProps['posts'];
    allCount: number;
    active: string;
    author: string;
    tags?: TagProps[];
    children: JSX.Element;
}

export function UserArticles(props: PostsProps) {
    const router = useRouter();

    const [search, setSearch] = useState('');

    const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        router.push(`/search?q=${search}&u=${props.author}`);
    };

    return (
        <>
            <div className="row">
                <Tags
                    allCount={props.allCount}
                    active={props.active}
                    author={props.author}
                    tags={props.tags}
                />
                <div>
                    <Flex align="center" justify="end">
                        <form className="search" onSubmit={handleSearch}>
                            <Flex align="center" gap={1}>
                                <BaseInput
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    tag="input"
                                    type="search"
                                    icon={<i className="fas fa-search" />}
                                    placeholder="검색어를 입력하세요."
                                />
                                <Button type="submit">
                                    검색
                                </Button>
                            </Flex>
                        </form>
                    </Flex>
                    <Articles posts={props.posts}>
                        {props.children}
                    </Articles>
                </div >
            </div >
            <style jsx>{`
                .row {
                    display: grid;
                    grid-template: 1fr / 280px 1fr;
                    gap: 1.5rem;

                    @media only screen and (max-width: 880px) {
                        grid-template: 1fr / 1fr;
                        gap: 0.5rem;
                    }
                }

                .search {
                    max-width: 300px;
                    width: 100%;
                    margin: 16px 0;

                    input {
                        flex: 1;
                    }

                    :global(button) {
                        padding: 0 !important;
                        width: 80px;
                        height: 40px;
                        border-radius: 8px;
                    }
                }
            `}</style>
        </>
    );
}
