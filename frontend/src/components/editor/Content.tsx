import styles from './styles.module.scss';

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
                            className={styles.content}
                            ref={el => this.textarea = el}
                            value={this.props.value}
                            placeholder="마크다운으로 글을 작성하세요."
                            onChange={(e) => this.props.onChange(e)}
                        />
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