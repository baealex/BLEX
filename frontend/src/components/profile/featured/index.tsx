import { Alert } from '@components/atoms';

import {
    ArticleCardSmall,
    ArticleCardSmallProps,
} from '@components/article';

export interface FeaturedProps {
    articles: ArticleCardSmallProps[];
}

export function Featured(props: FeaturedProps) {
    return (
        <>
            <div className="h5 noto font-weight-bold mt-5">
                인기 컨텐츠
            </div>
            {props.articles.length > 0 ? (
                <div className="row mt-1 mb-5">
                    {props.articles.map((article, idx) => (
                        <ArticleCardSmall key={idx} {...article}/>
                    ))}
                </div>
            ) : (
                <Alert className="mt-3">
                    아직 작성한 포스트가 없습니다.
                </Alert>
            )}
        </>
    )
}