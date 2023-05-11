import classNames from 'classnames/bind';
import styles from './Social.module.scss';
const cn = classNames.bind(styles);

export interface SocialProps {
    username: string;
    github?: string;
    twitter?: string;
    youtube?: string;
    facebook?: string;
    instagram?: string;
    linkedin?: string;
}

export function Social(props: SocialProps) {
    return (
        <ul className={cn('social')}>
            <li key={'rss'}>
                <a href={`/rss/@${props.username}`} data-name="rss">
                    <i className="fas fa-rss-square" />
                </a>
            </li>
            {['github', 'twitter', 'youtube', 'facebook', 'instagram', 'linkedin'].map((name) => (
                props[name as keyof SocialProps] && (
                    <li key={name}>
                        <a
                            data-name={name}
                            href={(
                                name === 'youtube'
                                    ? `https://youtube.com/channel/${props.youtube}`
                                    : name === 'linkedin'
                                        ? `https://linkedin.com/in/${props.linkedin}`
                                        : `https://${name}.com/${props[name as keyof SocialProps]}`
                            )}>
                            <i className={`fab fa-${name}`} />
                        </a>
                    </li>
                )
            ))}
        </ul>
    );
}