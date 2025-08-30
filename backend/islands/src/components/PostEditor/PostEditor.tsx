import React from 'react';
import PostEditorContainer from './PostEditorContainer';

type EditorMode = 'new' | 'edit' | 'temp';

interface PostEditorProps {
    mode: EditorMode;
    username?: string;
    postUrl?: string;
    tempToken?: string;
}

const PostEditor: React.FC<PostEditorProps> = (props) => {
    return <PostEditorContainer {...props} />;
};

export default PostEditor;