import Link from 'next/link';

import TagList from '../../tag/TagList';

export interface ArticelCardProps {
    url: string;
    title: string;
    image: string;
    author: string;
    createdDate: string;
    description: string;
    readTime: number;
    tag: string;
}

export default function ArticleCard(props: ArticelCardProps) {
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
            <p className="vs serif">{props.createdDate} · <span className="shallow-dark">{props.readTime} min read</span></p>
            <TagList author={props.author} tag={props.tag.split(',')}/>
        </div>
    )
}