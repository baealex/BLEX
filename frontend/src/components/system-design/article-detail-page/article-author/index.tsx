import classNames from 'classnames';
import styles from './ArticleAuthor.module.scss';

import Link from 'next/link';

import { Card } from '@components/design-system';

export interface ArticleAuthorProps {
    profile: {
        username: string;
        realname: string;
        image: string;
        bio: string;
    };
}

export function ArticleAuthor(props: ArticleAuthorProps) {
    return (
        <Card hasBackground isRounded className="p-3 mb-5">
            <div className="d-flex align-items-center">
                <div>
                    <Link href="/[author]" as={`/@${props.profile.username}`}>
                        <a>
                            <img
                                className={styles.image}
                                src={props.profile.image}
                                width="100"
                                height="100"
                            />
                        </a>
                    </Link>
                </div>
                <div className={classNames(styles.info)}>
                    <div className={styles.username}>
                        <Link href={`/@${props.profile.username}`}>
                            <a>
                                {props.profile.realname} (@{props.profile.username})
                            </a>
                        </Link>
                    </div>
                    <div className={styles.bio}>
                        <Link href={`/@${props.profile.username}/about`}>
                            <a>
                                {props.profile.bio}
                            </a>
                        </Link>
                    </div>
                </div>
            </div>
        </Card>
    );
}
