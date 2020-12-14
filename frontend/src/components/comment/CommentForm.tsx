import React from 'react';

import { toast } from 'react-toastify';

import { dropImage } from '@modules/image';

interface Props {
    onSubmit: Function;
};

interface State {
    comment: string;
}

class CommentForm extends React.Component<Props, State> {
    state: State = {
        comment: '',
    };

    input: HTMLTextAreaElement | null = null;

    onChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
        this.setState({
            ...this.state,
            comment: e.target.value
        });
    }

    async onDrop(e: React.DragEvent<HTMLTextAreaElement>) {
        const cursorPos = this.input?.selectionStart;
        const textBefore = this.state.comment.substring(0,  cursorPos);
        const textAfter  = this.state.comment.substring(cursorPos || 0, this.state.comment.length);

        const files = e.dataTransfer.files;
        if(files.length > 0) {
            const link = await dropImage(e);
            if(link) {
                const image = link.includes('.mp4') ? `@gif[${link}]` : `![](${link})`;
                this.setState({
                    comment: textBefore + `${image}` + textAfter
                });
                return;
            }
        }

        e.preventDefault();
        const data = e.dataTransfer.getData('text/plain');
        if(data.includes('/@')) {
            const username = data.split('/@').pop();
            this.setState({
                comment: textBefore + `\`@${username}\`` + textAfter
            });
            return;
        }
    }

    onSubmit() {
        if(this.state.comment == '') {
            toast('😅 댓글의 내용을 입력해주세요.');
            return;
        }
        this.props.onSubmit(this.state.comment);
        this.setState({
            ...this.state,
            comment: ''
        });
    }

    render() {
        return (
            <div className="comment-form mb-3">
                <textarea
                    ref={el => this.input = el}
                    rows={5}
                    className="form-control noto"
                    onChange={(e) => this.onChange(e)}
                    onDrop={(e) => this.onDrop(e)}
                    placeholder="배려와 매너가 밝은 커뮤니티를 만듭니다."
                    maxLength={300}
                    value={this.state.comment}>
                </textarea>
                <button
                    type="button"
                    onClick={() => this.onSubmit()}
                    className="btn btn-dark btn-block noto">
                    댓글 작성
                </button>
            </div>
        )
    }
}

export default CommentForm;