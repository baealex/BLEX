import {
    ArticleCardGroup,
    ArticleCardList,
    ArticleCardListProps
} from '@system-design/article';

export interface ArticlesProps {
    posts: ArticleCardListProps[];
    children: JSX.Element;
}

export function Articles(props: ArticlesProps) {
    return (
        <ArticleCardGroup hasDivider gap={5}>
            {props.posts.map((item, idx) => (
                <ArticleCardList key={idx} {...item}/>
            ))}
            {props.children}
        </ArticleCardGroup>
    );
}
