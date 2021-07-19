import styles from './Layout.module.scss';
import classNames from 'classnames/bind';
const cn = classNames.bind(styles);

import { Social, SocialProps } from '../../shared/social';
import { Navigation } from '../navigation';

export interface LayoutProps {
    profile: {
        image: string;
        realname: string;
        username: string;
    },
    social: SocialProps;
    active: string;
};

export function Layout(props: LayoutProps) {
    return (
        <>
            <div className="col-md-12">
                <div className={`${cn('user')} gothic`}>
                    <img className={cn('avatar')} src={props.profile.image}/>
                    <div className={cn('realname')}>{props.profile.realname}</div>
                    <div className={cn('username')}>@{props.profile.username}</div>
                    <Social {...props.social}/>
                </div>
            </div>
            <Navigation
                active={props.active}
                username={props.profile.username}
            />
        </>
    )
}