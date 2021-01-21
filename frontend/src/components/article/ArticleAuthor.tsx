import Link from 'next/link';
import Social, { SocialProps } from '../profile/Social';

export interface ArticleAuthorProps {
    profile: {
        username: string;
        realname: string;
        image: string;
        bio: string;
    };
    social: SocialProps;
};

export default function ArticleAuthor(props: ArticleAuthorProps) {
    return (
        <div className="row post-top-meta">
            <Link href="/[author]" as={`/@${props.profile.username}`}>
                <a>
                    <div className="back-image thumb author-thumb" style={{backgroundImage: `url(${props.profile.image})`}}/>
                </a>
            </Link>
            <div className="author-info">
                <h4 className="noto">{props.profile.realname}</h4>
                <h5 className="noto">@{props.profile.username}</h5>
                <p className="author-description mb-2">{props.profile.bio}</p>
                <Social {...props.social}/>
            </div>
        </div>
    )
}