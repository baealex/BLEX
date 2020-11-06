export default function CommentAlert(props: {
    text: string;
}) {
    return (
        <>
            <div className="comment-list noto s-shadow">
                {props.text}
            </div>
        </>
    )
}