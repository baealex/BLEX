import Link from 'next/link';

import PurpleBorder from "../common/PurpleBorder";

export default function FeatureContent(props) {
    return (
        <>
            <div className="h5 serif font-weight-bold mt-5">Featured Contents</div>
            {props.articles.length > 0 ? (
                <div className="row mt-1 mb-5">
                    {props.articles.map((article, idx) => (
                        <FeatureCard key={idx} {...article}/>
                    ))}
                </div>
            ) : (
                <PurpleBorder text="아직 작성한 포스트가 없습니다."/>
            )}
        </>
    )
}

function FeatureCard(props) {
    return (
        <div className="col-md-4 mt-3">
            <div className="blex-card noto">
                <Link href="/[author]/[posturl]" as={`@${props.author}/${props.url}`}>
                    <a className="deep-dark">
                        <img className="feature-image" src={`https://static.blex.me/${props.image}`}/>
                        <div className="p-3">
                            {props.title}
                            <div className="vs serif mt-2">{props.created_date} · <span className="shallow-dark">{props.read_time} min read</span></div>
                        </div>
                    </a>
                </Link>
            </div>
        </div>
    )
}