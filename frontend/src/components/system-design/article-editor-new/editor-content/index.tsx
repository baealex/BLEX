import styles from './EditorContent.module.scss';
import classNames from 'classnames/bind';
const cn = classNames.bind(styles);

import React, {
    useEffect,
    useState,
    useRef,
} from 'react';

import { ArticleContent } from '@components/system-design/article-detail-page';

import prism from '@modules/library/prism';
import blexer from '@modules/utility/blexer';
import { lazyLoadResource } from '@modules/optimize/lazy';

export interface EditorContentProps {
    refer: (el: HTMLTextAreaElement | null) => void;
    value: string;
    onChange: Function;
    isEditMode: boolean;
}

export function EditorContent() {
    const ref = useRef<HTMLTextAreaElement | null>();

    const [ active, setActive ] = useState(0);
    const [ contents, setContents ] = useState([
        {
            type: 'line',
            text: '#### 제목입니다.'
        },
        {
            type: 'line',
            text: '안녕하세요 배진오입니다. 테스트입니다.'
        },
        {
            type: 'line',
            text: '###### 소제목'
        },
        {
            type: 'line',
            text: '호호호'
        },
    ]);

    useEffect(() => {
        if (ref.current) {
            ref.current.style.height = 'auto';
            ref.current.style.height = `${ref.current.scrollHeight}px`;
        }
    }, [contents]);

    useEffect(() => {
        prism.highlightAll();
        lazyLoadResource();
        if (ref.current) {
            const end = ref.current.value.length;
            ref.current.focus();
            ref.current.setSelectionRange(end, end);
            ref.current.style.height = 'auto';
            ref.current.style.height = `${ref.current.scrollHeight}px`;
        }
    }, [active]);

    return (
        <div className={styles.layout}>
            {contents.map((content, idx) => (
                idx === active ? (
                    <textarea
                        ref={ref}
                        rows={1}
                        type="text"
                        value={content.text}
                        onChange={(e) => setContents((prevState) => {
                            const nextState = [...prevState];
                            nextState[active].text = e.target.value;
                            return nextState;
                        })}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && contents[active].type === 'line') {
                                e.preventDefault();
                                setActive(active => active + 1);
                            }
                        }}
                    />
                ) : (
                    <div onClick={() => setActive(idx)}>
                        <ArticleContent
                            isEdit
                            html={blexer(content.text)}
                        />
                    </div>
                )
            ))}
        </div>
    )
}