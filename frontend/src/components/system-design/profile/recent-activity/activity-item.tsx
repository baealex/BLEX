import Link from 'next/link';

import { Flex, Text } from '~/components/design-system';

export interface ActivityItemProps {
    url: string;
    type: string;
    text: string;
    createdDate: string;
}

export function ActivityItem(props: ActivityItemProps) {
    const className = `fas fa-${props.type}`;

    let description = '';
    switch (props.type) {
        case 'edit':
            description = '포스트를 작성하였습니다.';
            break;
        case 'comment':
            description = '포스트에 댓글을 남겼습니다.';
            break;
        case 'bookmark':
            description = '시리즈를 생성하였습니다.';
            break;
    }

    return (
        <Flex align="start" gap={2}>
            <i className={className} />
            <Flex
                className="w-100"
                justify="between"
                align="center"
                wrap="wrap"
                gap={1}>
                <Text fontSize={3}>
                    <Link className="shallow-dark" href={props.url}>
                        “{props.text}”
                    </Link>
                    {' '}
                    <span>{description}</span>
                </Text>
                <Text fontSize={2} className="shallow-dark">
                    {props.createdDate}
                </Text>
            </Flex>
        </Flex>
    );
}
