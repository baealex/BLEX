import Tags, { TagProps } from './Tags';
import Articles from './Article';

interface PostsProps {
    posts: any;
    active: string;
    author: string;
    tags: TagProps[];
    children: JSX.Element;
}

export default function Posts(props: PostsProps) {
    return (
        <div className="row">
            <Tags active={props.active} author={props.author} tags={props.tags}/>
            <Articles posts={props.posts}>
                {props.children}
            </Articles>
        </div>
    );
}