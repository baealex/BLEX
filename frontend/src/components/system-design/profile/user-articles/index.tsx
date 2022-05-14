import {
    TagProps,
    Tags
} from './tags';
import { Articles } from './articles';

interface PostsProps {
    posts: any;
    allCount: number;
    active: string;
    author: string;
    tags: TagProps[];
    children: JSX.Element;
}

export function UserArticles(props: PostsProps) {
    return (
        <div className="row">
            <Tags
                allCount={props.allCount}
                active={props.active}
                author={props.author}
                tags={props.tags}
            />
            <Articles posts={props.posts}>
                {props.children}
            </Articles>
        </div>
    );
}