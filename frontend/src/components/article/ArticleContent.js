export default function ArticleContent(props) {
    return (
        <div className="article noto" dangerouslySetInnerHTML={{ __html: props.html }}></div>
    )
}