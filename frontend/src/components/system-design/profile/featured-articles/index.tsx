import {
    ArticleCardSmall,
    ArticleCardSmallProps
} from '@system-design/article';

export interface FeaturedArticlesProps {
    articles: ArticleCardSmallProps[];
}

export function FeaturedArticles(props: FeaturedArticlesProps) {
    return (
        <>
            {props.articles.length > 0 && (
                <div className="grid-321 mt-2">
                    {props.articles.map((article, idx) => (
                        <ArticleCardSmall key={idx} {...article} />
                    ))}
                </div>
            )}
        </>
    );
}
