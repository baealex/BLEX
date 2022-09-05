import classNames from 'classnames';
import styles from './ArticleAuthor.module.scss';

import Link from 'next/link';

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
        <div className={`${styles.box} mb-5`}>
            <div className="d-flex align-items-center">
                <div>
                    <Link href="/[author]" as={`/@${props.profile.username}`}>
                        <a>
                            <img
                                className={styles.image}
                                src={props.profile.image}
                                width="50"
                                height="50"
                            />
                        </a>
                    </Link>
                </div>
                <div className={classNames(styles.info)}>
                    <div className={styles.username}>
                        <Link href={`/@${props.profile.username}`}>
                            <a>
                                {props.profile.name} (@{props.profile.username})
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
        </div>
    );
}
