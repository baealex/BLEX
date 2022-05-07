import classNames from 'classnames/bind';
import styles from './Layout.module.scss';
const cn = classNames.bind(styles);

import {
    useEffect, useState 
} from 'react';
import { useRouter } from 'next/router';

import {
    Footer,
    Social,
    SocialProps,
} from '@system-design/shared';
import { Button } from '@components/design-system';
import { ProfileNavigation } from '@system-design/profile';

import * as API from '@modules/api';

import { authStore } from '@stores/auth';

export interface ProfileLayoutProps {
    profile: {
        image: string;
        realname: string;
        username: string;
        bio: string;
    },
    social?: { homepage?: string; } & SocialProps;
    active: string;
    children?: JSX.Element;
}

export function ProfileLayout(props: ProfileLayoutProps) {
    const router = useRouter();

    const [ hasSubscribe, setHasSubscribe ] = useState(false);
    const [ isLogin, setIsLogin ] = useState(authStore.state.isLogin);
    const [ username, setUsername ] = useState(authStore.state.username);

    useEffect(authStore.syncValue('isLogin', setIsLogin), []);
    useEffect(authStore.syncValue('username', setUsername), []);

    useEffect(() => {
        if (isLogin) {
            if (username !== props.profile.username) {
                API.getUserProfile('@' + props.profile.username, ['subscribe']).then(({ data }) => {
                    setHasSubscribe(data.body.subscribe.hasSubscribe);
                });
            }
        }
    }, [isLogin, username, props.profile.username]);

    return (
        <>
            <div className="container">
                <div className={`${cn('user')}`}>
                    <img className={cn('avatar')} src={props.profile.image}/>
                    <div className={cn('realname')}>{props.profile.realname}</div>
                    <div className={cn('username')}>@{props.profile.username}</div>
                    {props.social && (
                        <Social {...props.social}/>
                    )}
                    {(props.social?.homepage || props.profile.bio) && (
                        <div className="d-flex justify-content-center align-items-center">
                            {props.social?.homepage && (
                                <div className={cn('homepage')}>
                                    <a href={`https://${props.social?.homepage}`}>
                                        {props.social?.homepage.split('/')[0]}
                                    </a>
                                </div>
                            )}
                            {(props.social?.homepage && props.profile.bio) && (
                                <div className={cn('divider')}>·</div>
                            )}
                            {props.profile.bio && (
                                <div className={cn('bio')}>
                                    {props.profile.bio}
                                </div>
                            )}
                        </div>
                    )}
                    {isLogin && (
                        username === props.profile.username ? (
                            <Button
                                isRounded
                                space="spare"
                                gap="little"
                                onClick={() => router.push('/setting/profile')}
                            >
                                프로필 편집
                            </Button>
                        ) : (
                            <Button
                                isRounded
                                space="spare"
                                gap="little"
                                color={hasSubscribe ? 'secondary' : 'default'}
                                onClick={() => API.putUserFollow('@' + props.profile.username).then(({ data }) => setHasSubscribe(data.body.hasSubscribe))}
                            >
                                <>
                                    { hasSubscribe ? '구독해제' : '구독하기' }
                                </>
                            </Button>
                        )
                    )}
                </div>
            </div>
            <ProfileNavigation
                active={props.active}
                username={props.profile.username}
            />
            {props.children}
            <Footer/>
        </>
    );
}