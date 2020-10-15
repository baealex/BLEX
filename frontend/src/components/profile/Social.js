export default function Social(props) {
    return (
        <ul className="social-link">
            <li><a className="vivid-purple" href={`/rss/@${props.username}`}><i className="fas fa-rss-square"></i></a></li>
            {props.github ? <li><a className="vivid-purple" href={`https://github.com/${props.github}`}><i className="fab fa-github-square"></i></a></li> : <></>}
            {props.twitter ? <li><a className="vivid-purple" href={`https://twitter.com/${props.twitter}`}><i className="fab fa-twitter-square"></i></a></li> : <></>}
            {props.youtube ? <li><a className="vivid-purple" href={`https://youtube.com/channel/${props.youtube}`}><i className="fab fa-youtube-square"></i></a></li> : <></>}
            {props.facebook ? <li><a className="vivid-purple" href={`https://facebook.com/${props.facebook}`}><i className="fab fa-facebook-square"></i></a></li> : <></>}
            {props.instagram ? <li><a className="vivid-purple" href={`https://instagram.com/${props.instagram}`}><i className="fab fa-instagram-square"></i></a></li> : <></>}
        </ul>
    )
}