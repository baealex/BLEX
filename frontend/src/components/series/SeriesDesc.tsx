import Link from 'next/link';

interface Props {
    owner: string;
    ownerImage: string;
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
                    <Link href="/[author]" as={`/@${props.owner}`}>
                        <a><img alt={props.owner} src={props.ownerImage}/></a>
                    </Link>
                </div>
            </div>
        </>
    )
}