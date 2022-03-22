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
import TrendyArticles from 'pages';

export interface EditorContentProps {
    refer: (el: HTMLTextAreaElement | null) => void;
    value: string;
    onChange: Function;
    isEditMode: boolean;
}

export function EditorContent() {
    const ref = useRef<HTMLTextAreaElement | null>(null);

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
    const [ active, setActive ] = useState(contents.length - 1);

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

    const handleKeydown = (e: KeyboardEvent) => {
        if (e.key === 'ArrowUp' && ref.current?.selectionStart === 0) {
            e.preventDefault();
            if (active > 0) {
                setActive(active => active - 1);
            }
        }

        if (e.key === 'ArrowDown' && ref.current?.selectionEnd === ref.current?.value.length) {
            e.preventDefault();
            if (active < contents.length - 1) {
                setActive(active => active + 1);
            }
        }

        if (e.key === 'Enter' && contents[active].type === 'line') {
            e.preventDefault();
            setContents(contents => [
                ...contents.slice(0, active + 1),
                {
                    type: 'line',
                    text: '',
                },
                ...contents.slice(active + 1, contents.length),
            ])
            setActive(active => active + 1);
        }

        if (e.key === 'Backspace' && contents[active].text === '') {
            e.preventDefault();
            setContents(contents => [
                ...contents.slice(0, active),
                ...contents.slice(active + 1, contents.length),
            ])
            setActive(active => active - 1);
        }
    }

    return (
        <div className={styles.layout}>
            {contents.map((content, idx) => (
                idx === active ? (
                    <>
                        <div className={styles.editor}>
                            <ul className={styles.helper}>
                                <li>
                                    H1
                                </li>
                                <li>
                                    H2
                                </li>
                                <li>
                                    H3
                                </li>
                                <li>
                                    <b>B</b>
                                </li>
                                <li>
                                    <i>I</i>
                                </li>
                                <li>
                                    <i className="fas fa-code"/>
                                </li>
                                <li>
                                    <i className="fas fa-table"/>
                                </li>
                                <li>
                                    <i className="far fa-image"/>
                                </li>
                                <li>
                                    <i className="fab fa-youtube"/>
                                </li>
                            </ul>
                            <textarea
                                ref={ref}
                                rows={1}
                                value={content.text}
                                onChange={(e) => setContents((prevState) => {
                                    const nextState = [...prevState];
                                    nextState[active].text = e.target.value;
                                    return nextState;
                                })}
                                onKeyDown={handleKeydown as any}
                            />
                        </div>
                    </>
                ) : (
                    <div className={styles.preview} onClick={() => setActive(idx)}>
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