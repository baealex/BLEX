import type { ReactNode } from 'react';

interface PostEditorWrapperProps {
    children: ReactNode;
    title: ReactNode;
}

const PostEditorWrapper = ({ children, title }: PostEditorWrapperProps) => {
    return (
        <div className="pt-8 pb-40 px-4 md:px-6">
            <div className="post-detail-layout">
                <aside className="post-detail-sidebar" aria-hidden="true" />
                <main className="post-detail-main">
                    <h1 className="sr-only">{title}</h1>
                    {children}
                </main>
                <aside className="post-detail-sidebar" aria-hidden="true" />
            </div>
        </div>
    );
};

export default PostEditorWrapper;
