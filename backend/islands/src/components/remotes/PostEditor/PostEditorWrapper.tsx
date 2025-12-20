import type { ReactNode } from 'react';

interface PostEditorWrapperProps {
    children: ReactNode;
}

const PostEditorWrapper = ({ children }: PostEditorWrapperProps) => {
    return (
        <div className="py-8">
            <div className="max-w-4xl w-full mx-auto px-4 md:px-6">
                {children}
            </div>
        </div>
    );
};

export default PostEditorWrapper;
