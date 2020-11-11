import Link from 'next/link';

export interface TopicsDescProps {
    url: string;
    author: string;
    description: string;
}

export default function TopicsDesc(props: TopicsDescProps) {
    return (
        <div className="description noto mt-4">
            <Link href="/[author]/[posturl]" as={`/@${props.author}/${props.url}`}>
                <a>{props.description}</a>
            </Link>
            <Link href="/[author]" as={`/@${props.author}`}>
                <a className="author">@{props.author}</a>
            </Link>
        </div>
    )
}