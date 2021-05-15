import PurpleBorder from "../../common/PurpleBorder";
import FeautreArticleCard, { FeautreArticleCardProps } from './Card';

interface FeatureArticleProps {
    articles: FeautreArticleCardProps[];
}

export default function FeatureArticle(props: FeatureArticleProps) {
    return (
        <>
            <div className="h5 noto font-weight-bold mt-5">
                인기 컨텐츠
            </div>
            {props.articles.length > 0 ? (
                <div className="row mt-1 mb-5">
                    {props.articles.map((article, idx) => (
                        <FeautreArticleCard key={idx} {...article}/>
                    ))}
                </div>
            ) : (
                <PurpleBorder text="아직 작성한 포스트가 없습니다."/>
            )}
        </>
    )
}