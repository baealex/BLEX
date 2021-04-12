interface Props {
    text: string;
}

export default function CommentAlert(props: Props) {
    return (
        <>
            <div className="comment-list noto s-shadow mb-3 py-4">
                {props.text}
            </div>
        </>
    )
}