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
import {
    ImageModal,
    YoutubeModal,
} from '../modals';

export interface EditorContentProps {
    refer: (el: HTMLTextAreaElement | null) => void;
    value: string;
    onChange: Function;
    isEditMode: boolean;
}

interface Content {
    id?: number,
    type: 'line' | 'lines';
    text: string;
}

let id = 0;

const initialContents: Content[] = [
    {
        type: 'line',
        text: ''
    },
];

export function EditorContent() {
    const ref = useRef<HTMLTextAreaElement | null>(null);

    const [ contents, handleSetContents ] = useState<Content[]>(
        initialContents.map(content => {
            if (!content.id) {
                content.id = id++;
            }
            return content;
        })
    );

    const setContents = (fn: (prevContents: Content[]) => Content[]) => {
        const nextContents = fn(contents).map(content => {
            if (!content.id) {
                content.id = id++;
            }
            return content;
        });
        handleSetContents(nextContents);
    }

    const [ active, setActive ] = useState(contents.length - 1);
    const [ modal, setModal ] = useState({
        isOpenImage: false,
        isOpenYoutube: false,
    })

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

    const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const clipboardText = e.clipboardData.getData('text');
        const textLines = clipboardText.split('\n');

        if (textLines.length < 2) {
            return;
        }

        e.preventDefault();
        let textAcc = '';
        let isCode = false;
        let isTable = false;

        const lineStack = [];
        const newContents: Content[] = [];

        for (const textLine of textLines) {
            if (textLine.startsWith('```')) {
                if (!isCode) {
                    isCode = true;
                }
                if (isCode) {
                    isCode = false;
                    const type = 'lines';
                    const text = lineStack.join('\n');
                    newContents.push({ type, text });
                    lineStack.splice(0, lineStack.length);
                    continue;
                }
            }

            if (isCode || isTable) {
                lineStack.push(textLine);
                continue;
            }

            const type = 'line';

            if (textLine === '' && textAcc) {
                newContents.push({ type, text: textAcc });
                textAcc = '';
                continue;
            }

            if (textLine === '<br>' || textLine === '<br/>') {
                newContents.push({ type, text: '' });
                continue;
            }

            textAcc += !textAcc ? textLine : ` ${textLine}`;
        }

        setContents(prevState => {
            const { text } = prevState[active];

            return [
                ...prevState.slice(0, active + (text ? 1 : 0)),
                ...newContents,
                ...prevState.slice(active + 1, prevState.length),
            ];
        });
        setActive(active => active + newContents.length);
    }

    const handleKeydownEditor = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
            if (active > 0) {
                setContents(contents => [
                    ...contents.slice(0, active),
                    ...contents.slice(active + 1, contents.length),
                ])
                setActive(active => active - 1);
            }
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
        });
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

    const handleClickBlockHelper = (type: 'line' | 'lines', data: string) => {
        setContents((prevState) => {
            const nextState = [...prevState];
            
            const text = nextState[active].text;

            if (!text) {
                nextState[active].type = type;
                nextState[active].text = data;
                return nextState;
            }

            if (text) {
                setActive(active => active + 1);
                return [
                    ...prevState.slice(0, active + 1),
                    {
                        type,
                        text: data,
                    },
                    {
                        type: 'line',
                        text: '',
                    },
                    ...prevState.slice(active + 1, prevState.length),
                ];   
            }

            return nextState;
        });
    }

    const modalToggle = (name: keyof typeof modal) => {
        setModal((prevState) => ({
            ...prevState,
            [name]: !prevState[name],
        }))
    }

    return (
        <>
            <div className={styles.layout}>
                {contents.map((content, idx) => (
                    <div key={content.id} className={styles.block}>
                        {idx === active ? (
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
                                        <li onClick={() => handleClickBlockHelper('lines', '```javascript\n\n```')}>
                                            <i className="fas fa-code"/>
                                        </li>
                                        <li onClick={() => handleClickBlockHelper('lines', '| Title1 | Title2 | Title3 |\n|---|---|---|\n| Content1 | Content2 |  Content3 |')}>
                                            <i className="fas fa-table"/>
                                        </li>
                                        <li onClick={() => modalToggle('isOpenImage')}>
                                            <i className="far fa-image"/>
                                        </li>
                                        <li onClick={() => modalToggle('isOpenYoutube')}>
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
                                        onKeyDown={handleKeydownEditor}
                                        onPaste={handlePaste}
                                    />
                                </div>
                            </>
                        ) : (
                            <>
                                <div className={styles.dropline}/>
                                <div className={styles.preview} onClick={() => setActive(idx)}>
                                    <ArticleContent
                                        isEdit
                                        html={blexer(content.text)}
                                    />
                                </div>
                            </>
                        )}
                    </div>
                ))}
            </div>

            <ImageModal
                isOpen={modal.isOpenImage}
                onClose={() => modalToggle('isOpenImage')}
                onUpload={(file) => {
                    // TODO: Image upload
                    const imageSrc = 'https://static.blex.me/assets/images/default-post.png';
                    handleClickBlockHelper(
                        'line',
                        imageSrc.includes('.mp4')
                            ? `@gif[${imageSrc}]`
                            : `![](${imageSrc})`
                    );
                }}
            />
            
            <YoutubeModal
                isOpen={modal.isOpenYoutube}
                onClose={() => modalToggle('isOpenYoutube')}
                onUpload={(id) => {
                    handleClickBlockHelper('line', `@youtube[${id}]`);
                }}
            />
        </>
    )
}