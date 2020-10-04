import Link from 'next/link'
import Social from '../profile/Social'

export default function ArticleAuthor(props) {
    return (
        <div class="row post-top-meta">
            <Link href="/[author]" as={`/@${props.profile.username}`}>
                <a>
                    <div class="back-image thumb author-thumb" style={{backgroundImage: `url(${props.profile.image})`}}/>
                </a>
            </Link>
            <div class="author-info">
                <h4 className="serif">{props.profile.realname}</h4>
                <h5 className="serif">@{props.profile.username}</h5>
                <p class="author-description mb-2">{props.profile.bio}</p>
                <Social {...props.social}/>
            </div>
        </div>
    )
}