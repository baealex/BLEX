import React from 'react';

import { toast } from 'react-toastify';

interface Props {
    pk: number;
    comment: string;
    onCancle: Function;
    onSubmit: Function;
};

interface State {
    comment: string;
};

class CommentForm extends React.Component<Props, State> {
    state: State = {
        comment: '',
    };

    onChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
        this.setState({
            ...this.state,
            comment: e.target.value
        });
    }

    onSubmit() {
        if(this.state.comment == '') {
            toast('😅 댓글의 내용을 입력해주세요.');
            return;
        }
        if(this.state.comment == this.props.comment) {
            this.props.onCancle(this.props.pk);
            return;
        }
        this.props.onSubmit(this.props.pk, this.state.comment);
    }

    render() {
        return (
            <div className="comment-form mb-3">
                <textarea
                    rows={5}
                    className="form-control noto"
                    onChange={(e) => this.onChange(e)}
                    placeholder="배려와 매너가 밝은 커뮤니티를 만듭니다."
                    maxLength={300}
                    value={this.state.comment}>
                </textarea>
                <button
                    type="button"
                    onClick={() => this.onSubmit()}
                    className="btn btn-dark btn-block noto">
                    완료
                </button>
            </div>
        )
    }
}

export default CommentForm