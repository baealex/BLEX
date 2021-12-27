import { Alert } from '@design-system';

import {
    ArticleCardList,
    ArticleCardListProps,
} from '@components/article';

export interface ArticlesProps {
    posts: ArticleCardListProps[];
    children: JSX.Element;
}

export function Articles(props: ArticlesProps) {
    return (
        <div className="col-lg-8 mt-4">
            {props.posts.length > 0 ? props.posts.map((item: ArticleCardListProps, idx: number) => (
                <ArticleCardList key={idx} {...item}/>
            )) : (
                <Alert>아직 작성한 포스트가 없습니다.</Alert>
            )}
            {props.children}
        </div>
    );
}