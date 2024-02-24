import classNames from 'classnames/bind';
import styles from './Layout.module.scss';
const cn = classNames.bind(styles);

import { useRouter } from 'next/router';
import { useValue } from 'badland-react';

import { Button, Flex } from '@design-system';
import {
    Footer,
    Social,
    SocialProps
} from '@system-design/shared';
import { ProfileNavigation } from '@system-design/profile';
import { SubscribeButton } from '@system-design/shared';

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
    children?: JSX.Element;
}

export function ProfileLayout(props: ProfileLayoutProps) {
    const router = useRouter();

    const [username] = useValue(authStore, 'username');

    return (
        <>
            <div className="container">
                <div className={`${cn('user')}`}>
                    <img className={cn('avatar')} src={props.profile.image} />
                    <div className={cn('name')}>{props.profile.name}</div>
                    <div className={cn('username')}>@{props.profile.username}</div>
                    {(props.profile.homepage || props.profile.bio) && (
                        <Flex justify="center" align="center">
                            {props.profile.homepage && (
                                <div className={cn('homepage')}>
                                    <a href={`${props.profile.homepage}`}>
                                        {props.profile.homepage.replace(/(^\w+:|^)\/\//, '').split('/')?.[0]}
                                    </a>
                                </div>
                            )}
                            {(props.profile.homepage && props.profile.bio) && (
                                <div className={cn('divider')}>·</div>
                            )}
                            {props.profile.bio && (
                                <div className={cn('bio')}>
                                    {props.profile.bio}
                                </div>
                            )}
                        </Flex>
                    )}
                    {props.social && (
                        <Social
                            username={props.profile.username}
                            social={props.social}
                        />
                    )}
                    {username === props.profile.username ? (
                        <Button
                            isRounded
                            space="spare"
                            gap="little"
                            onClick={() => router.push('/setting/profile')}>
                            프로필 편집
                        </Button>
                    ) : (
                        <SubscribeButton author={props.profile.username} />
                    )}
                </div>
            </div >
            <ProfileNavigation
                active={props.active}
                username={props.profile.username}
            />
            {props.children}
            <Footer />
        </>
    );
}
