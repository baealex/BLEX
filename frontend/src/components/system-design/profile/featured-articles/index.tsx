import {
    ArticleCardSmall,
    ArticleCardSmallProps
} from '@system-design/article';
import { Grid } from '~/components/design-system';

export interface FeaturedArticlesProps {
    articles: ArticleCardSmallProps[];
}

export function FeaturedArticles(props: FeaturedArticlesProps) {
    return (
        <>
            {props.articles.length > 0 && (
                <Grid
                    gap={3}
                    column={{
                        desktop: 3,
                        tablet: 2,
                        mobile: 1
                    }}>
                    {props.articles.map((article, idx) => (
                        <ArticleCardSmall key={idx} {...article} />
                    ))}
                </Grid>
            )}
        </>
    );
}
