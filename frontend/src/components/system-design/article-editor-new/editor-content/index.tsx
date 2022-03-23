import styles from './EditorContent.module.scss';

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
    const ref = useRef<HTMLTextAreaElement | null>(null);

    const [ contents, setContents ] = useState([
        {
            type: 'line',
            text: ''
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

    const handleKeydownEditor = (e: KeyboardEvent) => {
        console.log(e);

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

    const handleClickHeaderHelper = (level: 1 | 2 | 3) => {
        level -= 1;

        const h = [
            '## ',
            '#### ',
            '###### ',
        ]
        
        const keyword = h[level]

        setContents((prevState) => {
            const nextState = [...prevState];
            
            let text = nextState[active].text;

            if (prevState[active].text.startsWith(keyword)) {
                text = text.replace(keyword, '');
                nextState[active].text = text;
                return nextState;
            }

            for (let i=h.length-1; i>=0; i--) {
                text = text.replace(h[i], '');
            }
            nextState[active].text = keyword + text;
            return nextState;
        })
    }

    const handleClickContentHelper = (keyword: string) => {
        if (!ref.current) {
            return;
        }

        const {
            selectionStart,
            selectionEnd,
        } = ref.current;

        if (selectionStart === selectionEnd) {
            return;
        }

        setContents((prevState) => {
            const nextState = [...prevState];

            const text = nextState[active].text;
            let selectionText = text.slice(
                selectionStart,
                selectionEnd,
            );
            const textStart = text.slice(0, selectionStart);
            const textEnd = text.slice(selectionEnd, text.length);

            if (selectionText.startsWith(keyword) && selectionText.endsWith(keyword)) {
                selectionText = selectionText.replace(keyword, '');
                selectionText = selectionText.replace(keyword, '');
                nextState[active].text = textStart + selectionText + textEnd;
                return nextState;
            }

            nextState[active].text = textStart + keyword + selectionText + keyword + textEnd;
            return nextState;
        })
    }

    return (
        <div className={styles.layout}>
            {contents.map((content, idx) => (
                idx === active ? (
                    <>
                        <div className={styles.editor}>
                            <ul className={styles.helper}>
                                <li onClick={() => handleClickHeaderHelper(1)}>
                                    H1
                                </li>
                                <li onClick={() => handleClickHeaderHelper(2)}>
                                    H2
                                </li>
                                <li onClick={() => handleClickHeaderHelper(3)}>
                                    H3
                                </li>
                                <li onClick={() => handleClickContentHelper('**')}>
                                    <b>B</b>
                                </li>
                                <li onClick={() => handleClickContentHelper('*')}>
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
                                placeholder=""
                                onKeyDown={handleKeydownEditor as any}
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