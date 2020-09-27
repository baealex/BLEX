import React from 'react'

class CommentForm extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            comment: ''
        }
    }

    onChangeComment(e) {
        this.setState({
            ...this.state,
            comment: e.target.value
        });
    }

    onSubmutComment() {
        this.props.onSubmutComment(this.state.comment);
        this.setState({
            ...this.state,
            comment: ''
        });
    }

    render() {
        return (
            <div className="comment-form mb-3">
                <textarea
                    rows="5"
                    className="form-control noto"
                    onChange={(e) => this.onChangeComment(e)}
                    placeholder="배려와 매너가 밝은 커뮤니티를 만듭니다."
                    maxLength="300"
                    value={this.state.comment}>
                </textarea>
                <button
                    type="button"
                    onClick={() => this.onSubmutComment()}
                    className="btn btn-dark btn-block noto">
                    댓글 작성
                </button>
            </div>
        )
    }
}

export default CommentForm