export default function ArticleContent(props: {
    html: string;
}) {
    return (
        <div
            className="article noto"
            dangerouslySetInnerHTML={{ __html: props.html }}>
        </div>
    )
}