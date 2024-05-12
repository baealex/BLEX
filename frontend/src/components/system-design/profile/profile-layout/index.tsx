import classNames from 'classnames/bind';
import styles from './Layout.module.scss';
const cn = classNames.bind(styles);

import React from 'react';
import { useRouter } from 'next/router';
import { useValue } from 'badland-react';

import { Button, Container, Flex, PageNavigationLayout, Text } from '~/components/design-system';
import {
    Footer,
    Social,
    type SocialProps
} from '~/components/system-design/shared';
import { SubscribeButton } from '~/components/system-design/shared';

import { authStore } from '~/stores/auth';

export interface ProfileLayoutProps {
    profile: {
        image: string;
        name: string;
        username: string;
        bio: string;
        homepage: string;
    };
    social?: SocialProps['social'];
    active: string;
    children?: React.ReactNode;
}

export function ProfileLayout(props: ProfileLayoutProps) {
    const router = useRouter();

    const [username] = useValue(authStore, 'username');

    return (
        <>
            <Container>
                <div className={cn('layout')}>
                    <div>
                        <div className={cn('avatar')}>
                            <img src={props.profile.image} />
                        </div>
                        <Flex direction="column">
                            <Text fontSize={6} fontWeight={600}>{props.profile.name}</Text>
                            <Text fontSize={3} className="shallow-dark">@{props.profile.username}</Text>
                            <div className="mt-2">
                                {username === props.profile.username ? (
                                    <Button
                                        isRounded
                                        onClick={() => router.push('/setting/profile')}>
                                        프로필 편집
                                    </Button>
                                ) : (
                                    <SubscribeButton author={props.profile.username} />
                                )}
                            </div>
                            {props.profile.bio && (
                                <Text fontSize={3} className="shallow-dark mt-3">
                                    {props.profile.bio}
                                </Text>
                            )}
                        </Flex>
                        <div className="mt-3">
                            <Social
                                username={props.profile.username}
                                homepage={props.profile.homepage}
                                social={props.social}
                            />
                        </div>
                    </div>
                    <div>
                        <PageNavigationLayout
                            navigationActive={props.active}
                            navigationItems={[
                                {
                                    name: 'Overview',
                                    link: `/@${props.profile.username}`
                                },
                                {
                                    name: 'Posts',
                                    link: `/@${props.profile.username}/posts`
                                },
                                {
                                    name: 'Series',
                                    link: `/@${props.profile.username}/series`
                                }
                            ]}>
                            {props.children}
                        </PageNavigationLayout>
                    </div>
                </div>
            </Container>
            <Footer />
        </>
    );
}
