import styles from './Social.module.scss';
import classNames from 'classnames/bind';
const cn = classNames.bind(styles);

export interface SocialProps {
    username: string;
    github?: string;
    twitter?: string;
    youtube?: string;
    facebook?: string;
    instagram?: string;
};

export function Social(props: SocialProps) {
    return (
        <ul className={cn('social')}>
            <li><a className="vivid-purple" href={`/rss/@${props.username}`}><i className="fas fa-rss-square"></i></a></li>
            {props.github && (
                <li>
                    <a className="vivid-purple" href={`https://github.com/${props.github}`}>
                        <i className="fab fa-github-square"/>
                    </a>
                </li>
            )}
            {props.twitter && (
                <li>
                    <a className="vivid-purple" href={`https://twitter.com/${props.twitter}`}>
                        <i className="fab fa-twitter-square"/>
                    </a>
                </li>
            )}
            {props.youtube && (
                <li>
                    <a className="vivid-purple" href={`https://youtube.com/channel/${props.youtube}`}>
                        <i className="fab fa-youtube-square"/>
                    </a>
                </li>
            )}
            {props.facebook && (
                <li>
                    <a className="vivid-purple" href={`https://facebook.com/${props.facebook}`}>
                        <i className="fab fa-facebook-square"/>
                    </a>
                </li>
            )}
            {props.instagram && (
                <li>
                    <a className="vivid-purple" href={`https://instagram.com/${props.instagram}`}>
                        <i className="fab fa-instagram-square"/>
                    </a>
                </li>
            )}
        </ul>
    )
}