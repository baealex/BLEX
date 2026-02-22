import type { ReactNode } from 'react';

interface PostEditorWrapperProps {
    children: ReactNode;
}

const PostEditorWrapper = ({ children }: PostEditorWrapperProps) => {
    return (
        <div className="pt-8 pb-16 px-4 md:px-6">
            <div className="max-w-4xl w-full mx-auto">
                {children}
            </div>
        </div>
    );
};

export default PostEditorWrapper;
