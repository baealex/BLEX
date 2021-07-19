import styles from './ArticleAuthor.module.scss';
import classNames from 'classnames';

import Link from 'next/link';

import { Social, SocialProps } from '@components/shared';

export interface ArticleAuthorProps {
    profile: {
        username: string;
        realname: string;
        image: string;
        bio: string;
    };
    social?: SocialProps;
};

export function ArticleAuthor(props: ArticleAuthorProps) {
    return (
        <div className="d-flex align-items-center mb-5">
            <div>
            <Link href="/[author]" as={`/@${props.profile.username}`}>
                <a>
                    <img
                        className={styles.image}
                        src={props.profile.image}
                        width="130"
                        height="130"
                    />
                </a>
            </Link>
            </div>
            <div className={classNames(
                styles.info,
                'noto',
            )}>
                <div className={styles.realname}>
                    {props.profile.realname}
                </div>
                <div className={styles.username}>
                    @{props.profile.username}
                </div>
                <div className={styles.bio}>
                    {props.profile.bio}
                </div>
                <Social {...props.social!}/>
            </div>
        </div>
    )
}