import {
    ArticleCardSmall,
    ArticleCardSmallProps
} from '@system-design/article';
import { Text } from '@design-system';

export interface FeaturedArticlesProps {
    articles: ArticleCardSmallProps[];
}

export function FeaturedArticles(props: FeaturedArticlesProps) {
    return (
        <>
            {props.articles.length > 0 && (
                <>
                    <Text className="mt-5" fontWeight={700} fontSize={8}>
                        인기 컨텐츠
                    </Text>
                    <div className="grid-321">
                        {props.articles.map((article, idx) => (
                            <ArticleCardSmall key={idx} {...article}/>
                        ))}
                    </div>
                </>
            )}
        </>
    );
}
