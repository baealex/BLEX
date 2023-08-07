import classNames from 'classnames';
import styles from './ArticleAuthor.module.scss';

import Link from 'next/link';

import { Flex } from '@design-system';
import { SubscribeButton } from '@system-design/shared';

export interface ArticleAuthorProps {
    profile: {
        username: string;
        name: string;
        image: string;
        bio: string;
    };
}

export function ArticleAuthor(props: ArticleAuthorProps) {
    return (
        <div className="pt-5 pb-3">
            <Flex align="center" justify="between" wrap="wrap">
                <div className={classNames(styles.image)}>
                    <Link href="/[author]" as={`/@${props.profile.username}`}>
                        <img src={props.profile.image} />
                    </Link>
                </div>
                <div className={classNames(styles.info)}>
                    <div className={styles.username}>
                        <Link href={`/@${props.profile.username}`}>
                            {props.profile.name} (@{props.profile.username})
                        </Link>
                    </div>
                    <div className={styles.bio}>
                        <Link href={`/@${props.profile.username}/about`}>
                            {props.profile.bio}
                        </Link>
                    </div>
                </div>
                <SubscribeButton author={props.profile.username} />
            </Flex>
        </div>
    );
}
