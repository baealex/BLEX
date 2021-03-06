import classNames from 'classnames';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

import { Dropdown } from '@components/integrated';

export interface TagProps {
    name: string;
    count: number;
}

export interface TagsProps {
    allCount: number;
    active: string;
    author: string;
    tags: TagProps[];
}

function sorted(key: string, list: any) {
    return list.sort((left: any, right: any) => 
        left[key] > right[key]
            ? -1
            : left[key] < right[key]
                ? 1
                : 0
    );
}

export default function Tags(props: TagsProps) {
    const [tags, setTags] = useState(props.tags);

    const router = useRouter();

    return (
        <div className="profile-tags col-lg-3">
            <ul className="mt-4 noto">
                <div className="d-flex justify-content-between category">
                    <div className="h6 noto font-weight-bold">
                        카테고리
                    </div>
                    <Dropdown
                        button={
                            <i className="fas fa-exchange-alt fa-rotate-90"></i>
                        }
                        menus={[
                            {
                                name: '이름순',
                                onClick: () => setTags([...sorted('name', tags).reverse()])
                            },
                            {
                                name: '작성 갯수순',
                                onClick: () => setTags([...sorted('count', tags)])
                            },
                        ]}
                    />
                </div>
                <Link
                    href="/[author]/posts"
                    as={`/@${props.author}/posts`} 
                    scroll={false}
                >
                    <li>
                        <a className={classNames(
                            'ns',
                            'shallow-dark',
                            { active: props.active === 'all' }
                        )}>
                            전체 포스트 ({props.allCount})
                        </a>
                    </li>
                </Link>
                {tags.map((item, idx) => (
                    <Link
                        key={idx}
                        href={{
                            query: {
                                ...router.query,
                                tag: item.name,
                                page: 1,
                            }
                        }}
                        scroll={false}
                    >
                        <li>
                            <a className={classNames(
                                'ns',
                                'shallow-dark',
                                { active: props.active === item.name }
                            )}>
                                {item.name} ({item.count})
                            </a>
                        </li>
                    </Link>
                ))}
            </ul>
        </div>
    );
}