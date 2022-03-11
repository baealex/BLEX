import styles from './ArticleAuthor.module.scss';
import classNames from 'classnames';

import Link from 'next/link';

export interface ArticleAuthorProps {
    profile: {
        username: string;
        realname: string;
        image: string;
        bio: string;
    };
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
    )
}