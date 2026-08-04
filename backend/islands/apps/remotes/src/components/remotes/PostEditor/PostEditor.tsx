import { Trans } from '@lingui/react/macro';
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

const PostEditor = ({
    mode,
    username,
    postUrl,
    draftUrl,
    showFirstPublishGuide = false
}: PostEditorProps) => {
    if (mode === 'edit' && (!username || !postUrl)) {
        return (
            <div className="bg-surface-subtle py-4 sm:py-8">
                <div className="max-w-7xl w-full mx-auto">
                    <div className="bg-surface rounded-xl shadow-sm border border-line p-6">
                        <div className="text-center text-content-secondary">
                            <Trans id="editor.error.missing_edit_parameters">
                                Edit mode requires a username and post URL.
                            </Trans>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (mode === 'draft' && (!draftUrl || !username)) {
        return (
            <div className="bg-surface-subtle py-4 sm:py-8">
                <div className="max-w-7xl w-full mx-auto">
                    <div className="bg-surface rounded-xl shadow-sm border border-line p-6">
                        <div className="text-center text-content-secondary">
                            <Trans id="editor.error.missing_draft_parameters">
                                Draft mode requires a draft URL and username.
                            </Trans>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (mode === 'new' && !username) {
        return (
            <div className="bg-surface-subtle py-4 sm:py-8">
                <div className="max-w-7xl w-full mx-auto">
                    <div className="bg-surface rounded-xl shadow-sm border border-line p-6">
                        <div className="text-center text-content-secondary">
                            <Trans id="editor.error.missing_new_parameters">
                                New post mode requires a username.
                            </Trans>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    switch (mode) {
        case 'new':
        case 'draft':
            return <NewPostEditor draftUrl={draftUrl} showFirstPublishGuide={showFirstPublishGuide} />;

        case 'edit':
            return <EditPostEditor username={username!} postUrl={postUrl!} />;

        default:
            return (
                <div className="bg-surface-subtle py-4 sm:py-8">
                    <div className="max-w-7xl w-full mx-auto">
                        <div className="bg-surface rounded-xl shadow-sm border border-line p-6">
                            <div className="text-center text-content-secondary">
                                <Trans id="editor.error.unsupported_mode">
                                    Unsupported editor mode: {mode}
                                </Trans>
                            </div>
                        </div>
                    </div>
                </div>
            );
    }
};

export default PostEditor;
