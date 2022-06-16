import {
    ArticleCardList,
    ArticleCardListProps
} from '@system-design/article';

export interface ArticlesProps {
    posts: ArticleCardListProps[];
    children: JSX.Element;
}

export function Articles(props: ArticlesProps) {
    return (
        <div className="col-lg-8 mt-4">
            {props.posts.map((item, idx) => (
                <ArticleCardList key={idx} {...item}/>
            ))}
            {props.children}
        </div>
    );
}