import React from 'react';

import blexer from '@modules/blexer';
import ArticleContent from '@components/article/ArticleContent';
import {
    lazyLoadResource
} from '@modules/lazy';

interface Props {
    value: string;
    onChange: Function;
    isEditMode: boolean;
}

class EditorContent extends React.Component<Props> {
    public textarea: HTMLTextAreaElement | null;

    constructor(props: Props) {
        super(props);
        this.textarea = null;
    }

    componentDidMount() {
        const init = setInterval(() => {
            if(this.textarea) {
                this.textarea.style.height = this.textarea.scrollHeight + 'px';
                clearInterval(init);
            }
        }, 100);
    }

    componentDidUpdate() {
        if(this.textarea) {
            this.textarea.style.height = this.textarea.scrollHeight + 'px';
        }

        if(!this.props.isEditMode) {
            lazyLoadResource();
        }
    }

    render() {
        return (
            <>
                {this.props.isEditMode ? (
                    <>
                        <textarea
                            id="teatarea"
                            ref={el => this.textarea = el}
                            value={this.props.value}
                            placeholder="마크다운으로 글을 작성하세요."
                            onChange={(e) => this.props.onChange(e)}
                        />
                        <style jsx>{`
                            textarea {
                                width: 100%;
                                height: auto;
                                border: none;
                                font-size: 1.028em;
                                line-height: 2;
                                background: none;
                                display: block;
                                overflow: hidden;
                                resize: none;

                                &:focus {
                                    outline: none;    
                                }

                                @media (prefers-color-scheme: dark) {
                                    color: #ccc;
                                }
                            }
                        `}</style>
                    </>
                ) : (
                    <>
                        <ArticleContent isEdit html={blexer(this.props.value)}/>
                    </>
                )}
            </>
        )
    }
}

export default EditorContent;