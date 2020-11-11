import Link from 'next/link';

interface TagListProps {
    author: string;
    tag: string[];
}

export default function TagList(props: TagListProps) {
    return (
        <ul className="tag-list noto">
            {props.tag.map((item, idx) => (
                item != '' ? (
                    <li key={idx}>
                        <Link href="/[author]/posts/[tag]" as={`/@${props.author}/posts/${item}`}>
                            <a>{item}</a>
                        </Link>
                    </li>
                ) : ''
            ))}
        </ul>
    );
}