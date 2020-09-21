
import Link from 'next/link';
import PurpleBorder from '../common/PurpleBorder';

export default function Posts(props) {
    return (
        <div className="row">
            <Topics author={props.author} topic={props.topic}/>
            <Articles posts={props.posts}>
                {props.children}
            </Articles>
        </div>
    )
}

function Topics(props) {
    return (
        <div className="profile-tags col-lg-3">
            <ul className="mt-4 noto">
                <h5>카테고리</h5>
                <Link href="/[author]/posts" as={`/@${props.author}/posts`}>
                    <a className="shallow-dark">
                        <li>전체<span className="ns">({props.topic.reduce((acc, cur) => acc += cur.count, 0)})</span></li>
                    </a>
                </Link>
                {props.topic.map((item, idx) => (
                    <Link href="/[author]/posts/[topic]" as={`/@${props.author}/posts/${item.name}`}>
                        <a className="shallow-dark">
                            <li key={idx}>{item.name}<span className="ns">({item.count})</span></li>
                        </a>
                    </Link>
                ))}
            </ul>
        </div>
    );
}

function Articles(props) {
    return (
        <div className="col-lg-8 mt-4">
            {props.posts.length > 0 ? props.posts.map((item, idx) => (
                <ArticleCard key={idx} {...item}/>
            )) : (
                <PurpleBorder text="아직 작성한 포스트가 없습니다."/>
            )}
            {props.children}
        </div>
    );
}

function ArticleCard(props) {
    return (
        <div className="profile-post">
            <Link href="/[author]/[posturl]" as={`/@${props.author}/${props.url}`}>
                <a>
                    <img src={`https://static.blex.me/${props.image}`}/>
                </a>
            </Link>
            <h4 className="card-title serif font-weight-bold mt-3">
                <Link href="/[author]/[posturl]" as={`/@${props.author}/${props.url}`}>
                    <a className="deep-dark">
                        {props.title}
                    </a>
                </Link>
            </h4>
            <p className="noto">
                <Link href="/[author]/[posturl]" as={`/@${props.author}/${props.url}`}>
                    <a className="shallow-dark">
                        {props.description}
                    </a>
                </Link>
            </p>
            <p className="vs serif">{props.created_date} · <span className="shallow-dark">{props.read_time} min read</span></p>
        </div>
    )
}