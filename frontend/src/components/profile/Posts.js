
import Link from 'next/link';
import PurpleBorder from '../common/PurpleBorder';
import TagList from '../tag/TagList';

export default function Posts(props) {
    return (
        <div className="row">
            <Tags active={props.active} author={props.author} tags={props.tags}/>
            <Articles posts={props.posts}>
                {props.children}
            </Articles>
        </div>
    )
}

function Tags(props) {
    return (
        <div className="profile-tags col-lg-3">
            <ul className="mt-4 noto">
                <h5>카테고리</h5>
                <Link href="/[author]/posts" as={`/@${props.author}/posts`} scroll={false}>
                    <a className={`shallow-dark ${props.active === 'all' ? 'active' : ''}`}>
                        <li>전체 포스트</li>
                    </a>
                </Link>
                {props.tags.map((item, idx) => (
                    <Link key={idx} href="/[author]/posts/[tag]" as={`/@${props.author}/posts/${item.name}`} scroll={false}>
                        <a className={`shallow-dark ${props.active === item.name ? 'active' : ''}`}>
                            <li>{item.name}<span className="ns">({item.count})</span></li>
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
                    <img src={props.image}/>
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
            <TagList author={props.author} tag={props.tag.split(',')}/>
        </div>
    )
}