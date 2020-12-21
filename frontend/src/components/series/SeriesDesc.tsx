import Link from 'next/link';

interface Props {
    author: string;
    authorImage: string;
    description?: string;
};

export default function(props: Props) {
    return (
        <>
            <div className="series-desc mb-3">
                <blockquote className="noto">
                    {props.description ? props.description : '이 시리즈에 대한 설명이 없습니다.'}
                </blockquote>
                <div className="author">
                    <Link href="/[author]" as={`/@${props.author}`}>
                        <a><img alt={props.author} src={props.authorImage}/></a>
                    </Link>
                </div>
            </div>
        </>
    )
}