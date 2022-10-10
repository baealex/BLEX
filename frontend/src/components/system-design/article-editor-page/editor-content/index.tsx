import articleStyles from '../../article-detail-page/article-content/ArticleContent.module.scss';
import styles from './EditorContent.module.scss';

import React, {
    ReactNode,
    useEffect,
    useRef,
    useState
} from 'react';
import type EasyMDE from 'easymde';

import {
    FormsModal,
    YoutubeModal
} from '../modals';

import * as API from '~/modules/api';
import {
    dropImage,
    uploadImage
} from '~/modules/utility/image';
import blexer from '~/modules/utility/blexer';
import { codeMirrorAll } from '~/modules/library/codemirror';
import { lazyLoadResource } from '~/modules/optimize/lazy';

import { useFetch } from '~/hooks/use-fetch';

export interface EditorContentProps {
    value: string;
    onChange: (value: string) => void;
    addon?: {
        toolbar?: EasyMDE.ToolbarIcon[];
        modal?: ReactNode;
    };
}

export function EditorContent(props: EditorContentProps) {
    const editor = useRef<EasyMDE | null>(null);
    const textarea = useRef<HTMLTextAreaElement>(null);
    const imageInput = useRef<HTMLInputElement>(null);
    const [isEdit, setIsEdit] = useState(true);

    const { data: forms } = useFetch('forms', async () => {
        const { data } = await API.getSettingForms();
        return data.body.forms;
    });

    const [ modal, setModal ] = useState({
        isOpenForms: false,
        isOpenYoutube: false
    });

    useEffect(() => {
        const run = async () => {
            if (typeof window !== 'undefined' && textarea.current && !editor.current) {
                const { default: EasyMDE } = await import('easymde');
                if (textarea.current) {
                    editor.current = new EasyMDE({
                        element: textarea.current,
                        autoDownloadFontAwesome: false,
                        initialValue: props.value,
                        toolbar: [
                            {
                                name: 'heading-2',
                                action: EasyMDE.toggleHeading2,
                                className: 'fas fa-heading one',
                                title: '대제목'
                            },
                            {
                                name: 'heading-4',
                                action: EasyMDE.toggleHeading4,
                                className: 'fas fa-heading two',
                                title: '중간제목'
                            },
                            {
                                name: 'heading-6',
                                action: EasyMDE.toggleHeading6,
                                className: 'fas fa-heading three',
                                title: '소제목'
                            },
                            '|',
                            {
                                name: 'bold',
                                action: EasyMDE.toggleBold,
                                className: 'fa fa-bold',
                                title: '볼드'
                            },
                            {
                                name: 'italic',
                                action: EasyMDE.toggleItalic,
                                className: 'fa fa-italic',
                                title: '이텔릭'
                            },
                            {
                                name: 'strikethrough',
                                action: EasyMDE.toggleStrikethrough,
                                className: 'fa fa-strikethrough',
                                title: '취소선'
                            },
                            '|',
                            {
                                name: 'code',
                                action: EasyMDE.toggleCodeBlock,
                                className: 'fa fa-code',
                                title: '코드'
                            },
                            {
                                name: 'quote',
                                action: EasyMDE.toggleBlockquote,
                                className: 'fa fa-quote-left',
                                title: '인용구'
                            },
                            {
                                name: 'unordered-list',
                                action: EasyMDE.toggleUnorderedList,
                                className: 'fa fa-list-ul',
                                title: '순서없는 목록'
                            },
                            {
                                name: 'ordered-list',
                                action: EasyMDE.toggleOrderedList,
                                className: 'fa fa-list-ol',
                                title: '순서있는 목록'
                            },
                            '|',
                            {
                                name: 'link',
                                action: EasyMDE.drawLink,
                                className: 'fa fa-link',
                                title: '링크'
                            },
                            {
                                name: 'image',
                                action: () => {
                                    if (imageInput.current) {
                                        imageInput.current.click();
                                    }
                                },
                                className: 'far fa-image',
                                title: '이미지 업로드'
                            },
                            {
                                name: 'youtube',
                                action: () => modalToggle('isOpenYoutube'),
                                className: 'fab fa-youtube',
                                title: '유튜브 영상'
                            },
                            {
                                name: 'forms',
                                action: () => modalToggle('isOpenForms'),
                                className: 'fab fa-wpforms',
                                title: '서식'
                            },
                            ...props.addon?.toolbar || [],
                            '|',
                            {
                                name: 'preview',
                                action: (editor) => {
                                    setIsEdit((prev) => !prev);
                                    EasyMDE.togglePreview(editor);
                                },
                                className: 'fa fa-eye no-disable',
                                title: '미리보기'
                            },
                            '|',
                            {
                                name: 'guide',
                                action: '//notion.so/b3901e0837ec40e3983d16589314b59a',
                                className: 'fa fa-question-circle',
                                title: '마크다운 가이드'
                            }
                        ],
                        previewRender: blexer,
                        previewClass: [articleStyles.article, styles.preview],
                        spellChecker: false,
                        renderingConfig: {
                            codeSyntaxHighlighting: true
                        }
                    });
                }
            }
        };
        run();
    }, []);

    useEffect(() => {
        if (!isEdit) {
            const preview = document.querySelector(`.${styles.preview}`) as HTMLElement;
            const event = setTimeout(() => {
                lazyLoadResource();
                codeMirrorAll(preview);
                editor.current?.codemirror.setSize('auto', preview?.scrollHeight || 0) + 'px';
            }, 500);

            return () => clearTimeout(event);
        } else {
            editor.current?.codemirror.setSize('auto', 'auto');
        }
    }, [isEdit]);

    useEffect(() => {
        if (editor.current) {
            if (editor.current.value() !== props.value){
                editor.current.value(props.value);
            }
        }
    }, [props.value]);

    useEffect(() => {
        const handler = () => {
            if (editor.current?.value() !== props.value) {
                props.onChange(editor.current?.value() || '');
            }
        };
        editor.current?.codemirror.on('change', handler);

        return () => {
            editor.current?.codemirror.off('change', handler);
        };
    }, [ props.value, editor.current ]);

    const handleUploadImage = async (image: File) => {
        const imageSrc = await uploadImage(image);
        if (imageSrc && editor.current) {
            const imageMd = imageSrc.includes('.mp4')
                ? `@gif[${imageSrc}]`
                : `![](${imageSrc})`;
            editor.current.codemirror.replaceSelection(imageMd);
        }
    };

    const handleDropImage = async (e: React.DragEvent<HTMLDivElement>) => {
        const imageSrc = await dropImage(e);
        if (imageSrc && editor.current) {
            const imageMd = imageSrc.includes('.mp4')
                ? `@gif[${imageSrc}]`
                : `![](${imageSrc})`;
            editor.current.codemirror.replaceSelection(imageMd);
        }
    };

    const handleUploadYoutube = (id: string) => {
        if (id && editor.current) {
            const youtubeMd = `@youtube[${id}]`;
            editor.current.codemirror.replaceSelection(youtubeMd);
        }
    };

    const onFetchForm = async (id: number) => {
        const { data } = await API.getForm(id);
        if (data.body.content && editor.current) {
            editor.current.codemirror.replaceSelection(data.body.content);
        }
    };

    const modalToggle = (name: keyof typeof modal) => {
        setModal((prevState) => ({
            ...prevState,
            [name]: !prevState[name]
        }));
    };

    return (
        <>
            <input
                ref={imageInput}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                    if (e.target.files) {
                        handleUploadImage(e.target.files[0]);
                    }
                }}
            />
            <div
                className={styles.editor}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDropImage(e)}>
                <textarea
                    ref={textarea}
                    style={{ display: 'none' }}
                    placeholder="마크다운으로 글을 작성할 수 있어요!"
                />
            </div>
            <YoutubeModal
                isOpen={modal.isOpenYoutube}
                onClose={() => modalToggle('isOpenYoutube')}
                onUpload={handleUploadYoutube}
            />
            <FormsModal
                isOpen={modal.isOpenForms}
                onClose={() => modalToggle('isOpenForms')}
                onFetch={onFetchForm}
                forms={forms}
            />
            {props.addon?.modal}
        </>
    );
}
