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
                        <img
                            className={styles.image}
                            src={props.profile.image}
                            width="50"
                            height="50"
                        />
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
            </div>
        </div>
    );
}
