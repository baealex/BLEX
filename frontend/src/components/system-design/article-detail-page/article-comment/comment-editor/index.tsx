import React, { useState } from 'react';

import { Button } from '@design-system';
import { EditorContent } from '@system-design/article-editor-page';

import { snackBar } from '~/modules/ui/snack-bar';

export interface CommentEditorProps {
    pk: number;
    content: string;
    onCancel: (pk: number) => void;
    onSubmit: (pk: number, content: string) => void;
}

export function CommentEditor(props: CommentEditorProps) {
    const [content, setContent] = useState(props.content);

    const handleSubmit = () => {
        if (content == '') {
            snackBar('😅 댓글의 내용을 입력해주세요.');
            return;
        }
        if (content === props.content) {
            props.onCancel(props.pk);
            return;
        }
        props.onSubmit(props.pk, content);
    };

    return (
        <div className="mb-3">
            <EditorContent value={content} onChange={(value) => setContent(value)} />
            <Button display="block" type="button" onClick={handleSubmit}>
                <i className="fas fa-pencil-alt mr-2" />
                댓글 수정
            </Button>
        </div>
    );
}
