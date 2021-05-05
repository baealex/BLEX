import React, { useState } from 'react';

import { toast } from 'react-toastify';

interface Props {
    pk: number;
    content: string;
    onCancle: (pk: number) => void;
    onSubmit: (pk: number, content: string) => void;
};

export default function CommentForm(props: Props) {
    const [ content, setContent ] = useState(props.content);

    const onSubmit = () => {
        if(content == '') {
            toast('😅 댓글의 내용을 입력해주세요.');
            return;
        }
        if(content == props.content) {
            props.onCancle(props.pk);
            return;
        }
        props.onSubmit(props.pk, content);
    }

    return (
        <div className="comment-form mb-3">
            <textarea
                rows={5}
                className="form-control noto"
                onChange={(e) => setContent(e.target.value)}
                placeholder="배려와 매너가 밝은 커뮤니티를 만듭니다."
                maxLength={300}
                value={content}>
            </textarea>
            <button
                type="button"
                onClick={() => onSubmit()}
                className="btn btn-dark btn-block noto">
                완료
            </button>
        </div>
    );
}