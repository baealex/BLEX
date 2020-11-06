import Link from 'next/link';

export default function TopicsDesc(props) {
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