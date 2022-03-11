import React, { useState } from 'react';

import { snackBar } from '@modules/ui/snack-bar';

export interface CommentEditorProps {
    pk: number;
    content: string;
    onCancle: (pk: number) => void;
    onSubmit: (pk: number, content: string) => void;
};

export function CommentEditor(props: CommentEditorProps) {
    const [ content, setContent ] = useState(props.content);

    const onSubmit = () => {
        if(content == '') {
            snackBar('😅 댓글의 내용을 입력해주세요.');
            return;
        }
        if(content == props.content) {
            props.onCancle(props.pk);
            return;
        }
        props.onSubmit(props.pk, content);
    }

    return (
        <div className="mb-3">
            <textarea
                rows={5}
                className="form-control"
                onChange={(e) => setContent(e.target.value)}
                placeholder="배려와 매너가 밝은 커뮤니티를 만듭니다."
                maxLength={300}
                value={content}>
            </textarea>
            <button
                type="button"
                onClick={() => onSubmit()}
                className="btn btn-dark btn-block">
                완료
            </button>
        </div>
    );
}