interface CommentContentProps {
    renderedContent: string;
}

export const CommentContent = ({ renderedContent }: CommentContentProps) => {
    return (
        <div
            className="prose prose-sm sm:prose-base max-w-none text-gray-800 leading-relaxed break-words prose-headings:text-gray-900 prose-p:text-gray-800 prose-a:text-gray-900 prose-a:no-underline hover:prose-a:underline prose-strong:text-gray-900 prose-code:text-gray-800 prose-code:bg-gray-100 prose-code:px-1.5 prose-code:py-0.5 prose-pre:bg-gray-50 prose-pre:border prose-pre:border-gray-200"
            dangerouslySetInnerHTML={{ __html: renderedContent }}
        />
    );
};
