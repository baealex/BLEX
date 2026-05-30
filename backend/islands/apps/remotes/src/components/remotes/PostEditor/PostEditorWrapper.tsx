import type { ReactNode } from 'react';

interface PostEditorWrapperProps {
    children: ReactNode;
}

const PostEditorWrapper = ({ children }: PostEditorWrapperProps) => {
    return (
        <div className="pt-8 pb-16 px-4 md:px-6">
            <div className="post-detail-layout">
                <aside className="post-detail-sidebar" aria-hidden="true" />
                <main className="post-detail-main">
                    {children}
                </main>
                <aside className="post-detail-sidebar" aria-hidden="true" />
            </div>
        </div>
    );
};

export default PostEditorWrapper;
