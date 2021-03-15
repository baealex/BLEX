import React from 'react';

import blexer from '@modules/blexer';
import ArticleContent from '@components/article/ArticleContent';
import {
    lazyLoadResource
} from '@modules/lazy';

interface Props {
    text: string;
    isEdit: boolean;
    onChange: Function;
}

class EditorContent extends React.Component<Props> {
    private textarea: HTMLTextAreaElement | null;

    constructor(props: Props) {
        super(props);
        this.textarea = null;
    }

    componentDidUpdate() {
        if(this.textarea) {
            this.textarea.style.height = this.textarea.scrollHeight + 'px';
        }
        if(!this.props.isEdit) {
            lazyLoadResource();
        }
    }

    render() {
        return (
            <>
                {this.props.isEdit ? (
                    <>
                        <textarea
                            ref={el => this.textarea = el}
                            value={this.props.text} placeholder="마크다운으로 글을 작성하세요."
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
                        <ArticleContent html={blexer(this.props.text)}/>
                    </>
                )}
            </>
        )
    }
}

export default EditorContent;