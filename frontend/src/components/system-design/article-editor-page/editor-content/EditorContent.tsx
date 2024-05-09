import articleStyles from '../../article-detail-page/article-content/ArticleContent.module.scss';
import styles from './EditorContent.module.scss';

import React, {
    type ReactNode,
    useEffect,
    useRef,
    useState
} from 'react';
import EasyMDE from 'easymde';

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

export default function EditorContent(props: EditorContentProps) {
    const editor = useRef<EasyMDE | null>(null);
    const textarea = useRef<HTMLTextAreaElement>(null);
    const imageInput = useRef<HTMLInputElement>(null);

    const detectPreview = useRef<ReturnType<typeof setTimeout>>();
    const [isPreview, setIsPreview] = useState(false);

    const { data: forms } = useFetch('forms', async () => {
        const { data } = await API.getUserForms();
        return data.body.forms;
    });

    const [modal, setModal] = useState({
        isOpenForms: false,
        isOpenYoutube: false
    });

    useEffect(() => {
        if (textarea.current && !editor.current) {
            if (textarea.current) {
                const easyMDE = new EasyMDE({
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
                            action: EasyMDE.togglePreview,
                            className: 'fa fa-eye no-disable',
                            title: '미리보기'
                        }
                    ],
                    previewRender: blexer,
                    previewClass: [articleStyles.article, styles.preview],
                    spellChecker: false,
                    renderingConfig: {
                        codeSyntaxHighlighting: true
                    }
                });

                easyMDE.codemirror.on('change', () => {
                    props.onChange(easyMDE.value());
                });

                easyMDE.codemirror.on('paste', async (instance, event) => {
                    const item = event.clipboardData?.items[0];
                    if (item && item.type.indexOf('image') !== -1) {
                        const imageFile = item.getAsFile();
                        if (imageFile) {
                            const imageSrc = await uploadImage(imageFile);
                            if (imageSrc) {
                                const imageMd = imageSrc.includes('.mp4')
                                    ? `@gif[${imageSrc}]`
                                    : `![](${imageSrc})`;
                                instance.replaceSelection(imageMd);
                            }
                        }
                    }
                });

                easyMDE.codemirror.setOption('extraKeys', {
                    F11: () => {
                        return {
                            toString: () => 'CodeMirror.PASS'
                        };
                    },
                    Esc: () => {
                        return {
                            toString: () => 'CodeMirror.PASS'
                        };
                    }
                });

                editor.current = easyMDE;
            }
        }
    }, [textarea, editor]);

    useEffect(() => {
        const detect = () => {
            setIsPreview(editor.current?.isPreviewActive() || false);
            detectPreview.current = setTimeout(detect, 100);
        };
        detectPreview.current = setTimeout(detect, 100);
    }, []);

    useEffect(() => {
        if (isPreview) {
            const preview = document.querySelector(`.${styles.preview}`) as HTMLElement;

            lazyLoadResource(preview);
            codeMirrorAll(preview);
            editor.current?.codemirror.setSize('auto', preview.scrollHeight);

            const handleClickLink = (event: MouseEvent) => {
                const target = event.target as HTMLAnchorElement;
                if (target.tagName === 'A') {
                    event.preventDefault();
                    window.open(target.href, '_blank');
                }
            };

            preview.addEventListener('click', handleClickLink);
            return () => preview.removeEventListener('click', handleClickLink);
        }
        editor.current?.codemirror.setSize('auto', 'auto');
    }, [isPreview]);

    useEffect(() => {
        if (editor.current) {
            if (editor.current.value() !== props.value) {
                editor.current.value(props.value);
            }
        }
    }, [props.value]);

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
        const { data } = await API.getUserForm(id);
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
                    placeholder="마크다운으로 작성할 수 있어요."
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
