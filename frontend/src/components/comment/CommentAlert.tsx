interface Props {
    text: string;
}

export default function CommentAlert(props: Props) {
    return (
        <>
            <div className="comment-list noto s-shadow">
                {props.text}
            </div>
        </>
    )
}