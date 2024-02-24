import classNames from 'classnames/bind';
import styles from './Tags.module.scss';
const cn = classNames.bind(styles);

import Link from 'next/link';
import { useState } from 'react';

import { Dropdown, Flex, Text } from '@design-system';

import { sorted } from '~/modules/utility/object';

export interface TagProps {
    name: string;
    count: number;
}

export interface TagsProps {
    allCount: number;
    active: string;
    author: string;
    tags?: TagProps[];
}

export function Tags(props: TagsProps) {
    const [tags, setTags] = useState(props.tags || []);

    return (
        <div className={cn('tags', 'mt-4')}>
            <Flex justify="between" align="center" className={cn('category')}>
                <Text fontWeight={600} fontSize={4}>
                    태그
                </Text>
                <Dropdown
                    button={
                        <i className="fas fa-exchange-alt fa-rotate-90"></i>
                    }
                    menus={[
                        {
                            name: '이름순',
                            onClick: () => setTags(sorted(tags, { key: 'name' }))
                        },
                        {
                            name: '작성 갯수순',
                            onClick: () => setTags(sorted(tags, {
                                key: 'count',
                                reverse: true
                            }))
                        }
                    ]}
                />
            </Flex>
            <ul>
                <li>
                    <Link
                        className={cn('ns shallow-dark', { active: props.active === 'all' })}
                        href={`/@${props.author}/posts`}
                        scroll={false}>
                        전체 포스트 ({props.allCount})
                    </Link>
                </li>
                {tags.map((item, idx) => (
                    <li>
                        <Link
                            key={idx}
                            className={cn('ns shallow-dark', { active: props.active === item.name })}
                            href={`/@${props.author}/posts/${item.name}`}
                            scroll={false}>
                            {item.name} ({item.count})
                        </Link>
                    </li>
                ))}
            </ul>
        </div>
    );
}
