import classNames from 'classnames/bind';
import styles from './Layout.module.scss';
const cn = classNames.bind(styles);

import {
    Footer,
    Social,
    SocialProps,
} from '@system-design/shared';
import { ProfileNavigation } from '@system-design/profile';

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
    return (
        <>
            <div className="col-md-12">
                <div className={`${cn('user')} gothic`}>
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