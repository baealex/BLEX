import styles from './EditorContent.module.scss';
import classNames from 'classnames/bind';
const cn = classNames.bind(styles);

import React, {
    useEffect,
    useRef,
} from 'react';

import { ArticleContent } from '@components/article';

import blexer from '@modules/blexer';
import { lazyLoadResource } from '@modules/lazy';

export interface EditorContentProps {
    value: string;
    onChange: Function;
    isEditMode: boolean;
}

export function EditorContent(props: EditorContentProps) {
    const {
        isEditMode
    } = props;

    const textarea = useRef<HTMLTextAreaElement>(null);
    const preview = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (textarea.current && preview.current) {
            const textareaHeight = textarea.current.scrollHeight;
            const previewHeight = preview.current.offsetHeight;
            const maxHeight = textareaHeight > previewHeight
                ? textareaHeight
                : previewHeight;

            textarea.current.style.height = maxHeight + 'px';
            preview.current.style.height = maxHeight + 'px';
        }
    }, [props.value]);

    useEffect(() => {
        if (isEditMode) lazyLoadResource();
    }, [isEditMode]);

    return (
        <div className={styles.layout}>
            <textarea
                ref={textarea}
                className={cn(
                    'content',
                    { isEditMode }
                )}
                value={props.value}
                placeholder="마크다운으로 글을 작성하세요."
                onChange={(e) => props.onChange(e)}
            />
            <div
                ref={preview}
                className={cn(
                    'preview',
                    { isEditMode }
                )}
            >
                <ArticleContent
                    isEdit
                    html={blexer(props.value)}
                />
            </div>
        </div>
    )
}