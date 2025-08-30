import React from 'react';
import NewPostEditor from './NewPostEditor';
import EditPostEditor from './EditPostEditor';
import TempPostEditor from './TempPostEditor';

type EditorMode = 'new' | 'edit' | 'temp';

interface PostEditorContainerProps {
    mode: EditorMode;
    username?: string;
    postUrl?: string;
    tempToken?: string;
}

const PostEditorContainer: React.FC<PostEditorContainerProps> = ({
    mode,
    username,
    postUrl,
    tempToken
}) => {
    // Validate required props based on mode
    if (mode === 'edit' && (!username || !postUrl)) {
        return (
            <div className="bg-slate-50 py-4 sm:py-8">
                <div className="max-w-7xl w-full mx-auto">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                        <div className="text-center text-red-600">
                            편집 모드에는 username과 postUrl이 필요합니다.
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (mode === 'temp' && (!tempToken || !username)) {
        return (
            <div className="bg-slate-50 py-4 sm:py-8">
                <div className="max-w-7xl w-full mx-auto">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                        <div className="text-center text-red-600">
                            임시저장 모드에는 tempToken과 username이 필요합니다.
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (mode === 'new' && !username) {
        return (
            <div className="bg-slate-50 py-4 sm:py-8">
                <div className="max-w-7xl w-full mx-auto">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                        <div className="text-center text-red-600">
                            새 글 작성 모드에는 username이 필요합니다.
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Render appropriate editor based on mode
    switch (mode) {
        case 'new':
            return <NewPostEditor />;

        case 'temp':
            return <TempPostEditor tempToken={tempToken!} />;

        case 'edit':
            return <EditPostEditor username={username!} postUrl={postUrl!} />;

        default:
            return (
                <div className="bg-slate-50 py-4 sm:py-8">
                    <div className="max-w-7xl w-full mx-auto">
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                            <div className="text-center text-red-600">
                                지원되지 않는 모드입니다: {mode}
                            </div>
                        </div>
                    </div>
                </div>
            );
    }
};

export default PostEditorContainer;
