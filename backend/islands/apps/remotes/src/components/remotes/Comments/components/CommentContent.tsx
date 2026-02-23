interface CommentContentProps {
    renderedContent: string;
}

export const CommentContent = ({ renderedContent }: CommentContentProps) => {
    return (
        <div
            className="prose prose-sm sm:prose-base max-w-none text-content leading-relaxed break-words prose-headings:text-content prose-p:text-content prose-a:text-content prose-a:no-underline hover:prose-a:underline prose-strong:text-content prose-code:text-content prose-code:bg-surface-subtle prose-code:px-1.5 prose-code:py-0.5 prose-pre:bg-surface-subtle prose-pre:border prose-pre:border-line"
            dangerouslySetInnerHTML={{ __html: renderedContent }}
        />
    );
};
