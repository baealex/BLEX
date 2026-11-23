import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';
import NewPostEditor from './NewPostEditor';
import EditPostEditor from './EditPostEditor';

type EditorMode = 'new' | 'edit' | 'draft';

interface PostEditorProps {
    mode: EditorMode;
    username?: string;
    postUrl?: string;
    draftUrl?: string;
    showFirstPublishGuide?: boolean;
}

const EditorError = ({ children }: { children: ReactNode }) => (
    <div className="bg-surface-subtle py-4 sm:py-8">
        <div className="max-w-7xl w-full mx-auto">
            <div className="bg-surface rounded-xl shadow-sm border border-line p-6">
                <div className="text-center text-content-secondary">{children}</div>
            </div>
        </div>
    </div>
);

const PostEditor = ({ mode, username, postUrl, draftUrl, showFirstPublishGuide = false }: PostEditorProps) => {
    switch (mode) {
        case 'new':
            if (!username) {
                return (
                    <EditorError>
                        <Trans id="editor.error.missing_new_parameters">New post mode requires a username.</Trans>
                    </EditorError>
                );
            }
            return (
                <NewPostEditor username={username} draftUrl={draftUrl} showFirstPublishGuide={showFirstPublishGuide} />
            );

        case 'draft':
            if (!draftUrl || !username) {
                return (
                    <EditorError>
                        <Trans id="editor.error.missing_draft_parameters">
                            Draft mode requires a draft URL and username.
                        </Trans>
                    </EditorError>
                );
            }
            return (
                <NewPostEditor username={username} draftUrl={draftUrl} showFirstPublishGuide={showFirstPublishGuide} />
            );

        case 'edit':
            if (!username || !postUrl) {
                return (
                    <EditorError>
                        <Trans id="editor.error.missing_edit_parameters">
                            Edit mode requires a username and post URL.
                        </Trans>
                    </EditorError>
                );
            }
            return <EditPostEditor username={username} postUrl={postUrl} />;

        default:
            return (
                <EditorError>
                    <Trans id="editor.error.unsupported_mode">Unsupported editor mode: {mode}</Trans>
                </EditorError>
            );
    }
};

export default PostEditor;
