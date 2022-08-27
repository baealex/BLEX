import classNames from 'classnames/bind';
import styles from './EditorContent.module.scss';
const cn = classNames.bind(styles);

import React, {
    useEffect,
    useRef,
    useState
} from 'react';

import { PopOver } from '@design-system';

import { ArticleContent } from '@system-design/article-detail-page';

import {
    FormsModal,
    YoutubeModal
} from '../../shared/modals';

import * as API from '~/modules/api';
import {
    dropImage,
    uploadImage
} from '~/modules/utility/image';
import blexer from '~/modules/utility/blexer';
import { codeMirrorAll } from '~/modules/library/codemirror';
import { lazyLoadResource } from '~/modules/optimize/lazy';

export interface EditorContentProps {
    value: string;
    onChange: (value: string) => void;
    addon?: {
        sideButton: JSX.Element | JSX.Element[];
    };
}

export function EditorContent(props: EditorContentProps) {
    const textarea = useRef<HTMLTextAreaElement>(null);
    const preview = useRef<HTMLDivElement>(null);
    const imageInput = useRef<HTMLInputElement>(null);

    const [ isEdit, setIsEdit] = useState(true);
    const [ forms, setForms ] = useState<API.GetSettingFormsResponseData['forms']>();
    const [ modal, setModal ] = useState({
        isOpenForms: false,
        isOpenYoutube: false
    });

    useEffect(() => {
        API.getSettingForms().then((response) => {
            const { data } = response;
            setForms(data.body.forms);
        });
    }, []);

    useEffect(() => {
        if (textarea.current && preview.current) {
            const textareaHeight = textarea.current.scrollHeight;
            const previewHeight = preview.current.offsetHeight;
            const maxHeight = Math.max(textareaHeight, previewHeight);

            textarea.current.style.height = maxHeight + 'px';
            preview.current.style.height = maxHeight + 'px';
        }
    }, [props.value]);

    useEffect(() => {
        if (!isEdit) {
            codeMirrorAll();
            lazyLoadResource();
        }
    }, [isEdit]);

    const appendTextAfterCursor = (text: string) => {
        const cursorPos = textarea.current?.selectionStart;
        let appendText = '';

        if (cursorPos) {
            const preText = props.value.substr(0, cursorPos);
            const endText = props.value.substr(cursorPos, props.value.length - 1);

            if (preText && preText[preText.length - 1] !== '\n') {
                appendText += '\n';
            }
            appendText += text;

            if (endText && endText[0] !== '\n') {
                appendText += '\n';
            }

            props.onChange(preText + appendText + endText);
        } else {
            if (props.value && props.value[props.value.length - 1] !== '\n') {
                appendText += '\n';
            }
            appendText += text;

            props.onChange(props.value + appendText);
        }
    };

    const handleUploadImage = async (image: File) => {
        const imageSrc = await uploadImage(image);
        if (imageSrc) {
            const imageMd = imageSrc.includes('.mp4')
                ? `@gif[${imageSrc}]`
                : `![](${imageSrc})`;
            appendTextAfterCursor(imageMd);
        }
    };

    const handleDropImage = async (e: React.DragEvent<HTMLDivElement>) => {
        const imageSrc = await dropImage(e);
        if (imageSrc) {
            const imageMd = imageSrc.includes('.mp4')
                ? `@gif[${imageSrc}]`
                : `![](${imageSrc})`;
            appendTextAfterCursor(imageMd);
        }
    };

    const onFetchForm = async (id: number) => {
        const { data } = await API.getForm(id);
        if (data.body.content) {
            appendTextAfterCursor(data.body.content);
        }
    };

    const handleUploadYoutube = (id: string) => {
        if (id) {
            const youtubeMd = `@youtube[${id}]`;
            appendTextAfterCursor(youtubeMd);
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
            <div className="row justify-content-center">
                <div
                    className="col-lg-8"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDropImage(e)}>
                    <div className={cn('layout')}>
                        <textarea
                            ref={textarea}
                            className={cn(
                                'content',
                                { isEdit }
                            )}
                            value={props.value}
                            placeholder="마크다운으로 글을 작성하세요."
                            onChange={(e) => props.onChange(e.target.value)}
                        />
                        <div
                            ref={preview}
                            className={cn(
                                'preview',
                                { isEdit }
                            )}>
                            <ArticleContent isEdit html={!isEdit ? blexer(props.value) : ''} />
                        </div>
                    </div>
                </div>
                <div className="col-lg-2">
                    <div className="sticky-top sticky-top-100">
                        <div className={cn('tools')}>
                            <ul className="px-3">
                                <li className="mx-3 mx-lg-4" onClick={() => imageInput.current?.click()}>
                                    <PopOver text="이미지 업로드">
                                        <i className="far fa-image"/>
                                    </PopOver>
                                </li>
                                <li className="mx-3 mx-lg-4" onClick={() => modalToggle('isOpenYoutube')}>
                                    <PopOver text="유튜브 영상">
                                        <i className="fab fa-youtube"/>
                                    </PopOver>
                                </li>
                                <li className="mx-3 mx-lg-4" onClick={() => setIsEdit(isEdit => !isEdit)}>
                                    {isEdit ? (
                                        <PopOver text="편집모드">
                                            <i className="far fa-eye-slash"/>
                                        </PopOver>
                                    ) : (
                                        <PopOver text="미리보기">
                                            <i className="far fa-eye"/>
                                        </PopOver>
                                    )}
                                </li>
                                <li className="mx-3 mx-lg-4" onClick={() => modalToggle('isOpenForms')}>
                                    <PopOver text="서식 불러오기">
                                        <i className="fab fa-wpforms"></i>
                                    </PopOver>
                                </li>
                                {props.addon?.sideButton}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            <YoutubeModal
                isOpen={modal.isOpenYoutube}
                onClose={() => modalToggle('isOpenYoutube')}
                onUpload={(id) => handleUploadYoutube(id)}
            />

            <FormsModal
                isOpen={modal.isOpenForms}
                onClose={() => modalToggle('isOpenForms')}
                onFetch={onFetchForm}
                forms={forms}
            />
        </>
    );
}