import React, { useState } from 'react';

import { toast } from 'react-toastify';

import { dropImage } from '@modules/image';

interface Props {
    onSubmit: Function;
};

export default function CommentForm(props: Props) {
    const [ content, setContent ] = useState('');

    let input: HTMLTextAreaElement | null;

    const onDrop = async (e: React.DragEvent<HTMLTextAreaElement>) => {
        const cursorPos = input?.selectionStart;
        const textBefore = content.substring(0,  cursorPos);
        const textAfter  = content.substring(cursorPos || 0, content.length);

        const files = e.dataTransfer.files;
        if(files.length > 0) {
            const link = await dropImage(e);
            if(link) {
                const image = link.includes('.mp4') ? `@gif[${link}]` : `![](${link})`;
                setContent(textBefore + `${image}` + textAfter);
                return;
            }
        }

        e.preventDefault();
        const data = e.dataTransfer.getData('text/plain');
        if(data.includes('/@')) {
            const username = data.split('/@').pop();
            setContent(textBefore + `\`@${username}\`` + textAfter);
            return;
        }
    }

    const onSubmit = () => {
        if(content == '') {
            toast('😅 댓글의 내용을 입력해주세요.');
            return;
        }
        props.onSubmit(content);
        setContent('');
    }

    return (
        <div className="comment-form mb-3">
            <textarea
                ref={el => input = el}
                rows={5}
                className="form-control noto"
                onChange={(e) => setContent(e.target.value)}
                onDrop={(e) => onDrop(e)}
                placeholder="배려와 매너가 밝은 커뮤니티를 만듭니다."
                maxLength={300}
                value={content}>
            </textarea>
            <button
                type="button"
                onClick={() => onSubmit()}
                className="btn btn-dark btn-block noto">
                댓글 작성
            </button>
        </div>
    );
}