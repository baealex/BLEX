import Link from 'next/link'

export interface TopicItemProps {
    name: string;
    count: number;
    description: string;
}

export default function TopicItem(props: TopicItemProps) {
    return (
        <div className="col-12 col-md-6 col-lg-4 mt-5">
            <div className="tag-card">
                <div className="serif title">
                    <Link href="/tags/[tag]" as={`/tags/${props.name}`}>
                        <a className="shallow-dark">{props.name} ({props.count})</a>
                    </Link>
                </div>
                {props.description ? (
                    <div className="noto ns">
                        <Link href="/tags/[tag]" as={`/tags/${props.name}`}>
                            <a className="gray-dark">{props.description}</a>
                        </Link>
                    </div>
                ) : ''}
            </div>
        </div>
    )
}