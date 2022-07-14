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
                <>
                    <div className="h4 font-weight-bold mt-5">
                        인기 컨텐츠
                    </div>
                    <div className="row mt-3">
                        {props.articles.map((article, idx) => (
                            <ArticleCardSmall key={idx} {...article}/>
                        ))}
                    </div>
                </>
            )}
        </>
    );
}