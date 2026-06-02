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
                            편집 모드에는 username과 postUrl이 필요합니다.
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
                            임시저장 모드에는 draftUrl과 username이 필요합니다.
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
                            새 포스트 작성 모드에는 username이 필요합니다.
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
                                지원되지 않는 모드입니다: {mode}
                            </div>
                        </div>
                    </div>
                </div>
            );
    }
};

export default PostEditor;
