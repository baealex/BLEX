import Tags, { TagProps } from './Tags';
import Articles from './Article';

interface PostsProps {
    posts: any;
    allCount: number;
    active: string;
    author: string;
    tags: TagProps[];
    children: JSX.Element;
}

export default function Posts(props: PostsProps) {
    return (
        <div className="row">
            <Tags allCount={props.allCount} active={props.active} author={props.author} tags={props.tags}/>
            <Articles posts={props.posts}>
                {props.children}
            </Articles>
        </div>
    );
}