import type { ReactNode } from 'react';

interface PostEditorWrapperProps {
    children: ReactNode;
}

const PostEditorWrapper = ({ children }: PostEditorWrapperProps) => {
    return (
        <div className="pt-8 pb-16 px-4 md:px-6">
            <div className="flex justify-center gap-6">
                <aside className="hidden xl:block w-64 flex-shrink-0" aria-hidden="true" />
                <main className="max-w-4xl w-full">
                    {children}
                </main>
                <aside className="hidden xl:block w-64 flex-shrink-0" aria-hidden="true" />
            </div>
        </div>
    );
};

export default PostEditorWrapper;
