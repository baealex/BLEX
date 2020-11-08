import PurpleBorder from '../../common/PurpleBorder';

import ArticleCard, { ArticelCardProps } from './ArticleCard';

export interface ArticlesProps {
    posts: ArticelCardProps[];
    children: JSX.Element;
}

export default function Articles(props: ArticlesProps) {
    return (
        <div className="col-lg-8 mt-4">
            {props.posts.length > 0 ? props.posts.map((item: ArticelCardProps, idx: number) => (
                <ArticleCard key={idx} {...item}/>
            )) : (
                <PurpleBorder text="아직 작성한 포스트가 없습니다."/>
            )}
            {props.children}
        </div>
    );
}