interface CommentContentProps {
    renderedContent: string;
}

export const CommentContent = ({ renderedContent }: CommentContentProps) => {
    return (
        <div
            className="comment-content"
            dangerouslySetInnerHTML={{ __html: renderedContent }}
        />
    );
};
