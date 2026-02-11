import NewPostEditor from './NewPostEditor';
import EditPostEditor from './EditPostEditor';

type EditorMode = 'new' | 'edit' | 'draft';

interface PostEditorProps {
    mode: EditorMode;
    username?: string;
    postUrl?: string;
    draftUrl?: string;
}

const PostEditor = ({
    mode,
    username,
    postUrl,
    draftUrl
}: PostEditorProps) => {
    if (mode === 'edit' && (!username || !postUrl)) {
        return (
            <div className="bg-gray-50 py-4 sm:py-8">
                <div className="max-w-7xl w-full mx-auto">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <div className="text-center text-gray-600">
                            편집 모드에는 username과 postUrl이 필요합니다.
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (mode === 'draft' && (!draftUrl || !username)) {
        return (
            <div className="bg-gray-50 py-4 sm:py-8">
                <div className="max-w-7xl w-full mx-auto">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <div className="text-center text-gray-600">
                            임시저장 모드에는 draftUrl과 username이 필요합니다.
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (mode === 'new' && !username) {
        return (
            <div className="bg-gray-50 py-4 sm:py-8">
                <div className="max-w-7xl w-full mx-auto">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <div className="text-center text-gray-600">
                            새 글 작성 모드에는 username이 필요합니다.
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    switch (mode) {
        case 'new':
        case 'draft':
            return <NewPostEditor draftUrl={draftUrl} />;

        case 'edit':
            return <EditPostEditor username={username!} postUrl={postUrl!} />;

        default:
            return (
                <div className="bg-gray-50 py-4 sm:py-8">
                    <div className="max-w-7xl w-full mx-auto">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <div className="text-center text-gray-600">
                                지원되지 않는 모드입니다: {mode}
                            </div>
                        </div>
                    </div>
                </div>
            );
    }
};

export default PostEditor;
