import Link from 'next/link';

export interface TagProps {
    name: string;
    count: number;
}

export interface TagsProps {
    allCount: number;
    active: string;
    author: string;
    tags: TagProps[];
}

export default function Tags(props: TagsProps) {
    return (
        <div className="profile-tags col-lg-3">
            <ul className="mt-4 noto">
                <h5>카테고리</h5>
                <Link href="/[author]/posts" as={`/@${props.author}/posts`} scroll={false}>
                    <a className={`shallow-dark ${props.active === 'all' ? 'active' : ''}`}>
                        <li>전체 포스트<span className="ns">({props.allCount})</span></li>
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