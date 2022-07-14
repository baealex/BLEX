import { Articles, ArticlesProps } from './articles';
import { TagProps, Tags } from './tags';

interface PostsProps {
    posts: ArticlesProps['posts'];
    allCount: number;
    active: string;
    author: string;
    tags?: TagProps[];
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