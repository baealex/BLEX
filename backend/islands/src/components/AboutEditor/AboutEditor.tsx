import React, { useState, useEffect, useRef } from 'react';
import { http } from '~/modules/http.module';
import { notification } from '@baejino/ui';
import EasyMDE from 'easymde';

import 'easymde/dist/easymde.min.css';

interface AboutEditorProps {
    initialValue?: string;
    username?: string;
    placeholder?: string;
    successMessage?: string;
    redirectPath?: string;
}

const AboutEditor: React.FC<AboutEditorProps> = ({
    initialValue = '',
    username = '',
    placeholder = '자신을 소개해보세요...',
    successMessage = '소개가 업데이트되었습니다.',
    redirectPath
}) => {
    const [value, setValue] = useState(initialValue);
    const [isLoading, setIsLoading] = useState(false);
    const editor = useRef<EasyMDE | null>(null);
    const textarea = useRef<HTMLTextAreaElement>(null);
    const imageInput = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (textarea.current && !editor.current) {
            const easyMDE = new EasyMDE({
                element: textarea.current,
                autoDownloadFontAwesome: false,
                initialValue: initialValue,
                placeholder,
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
                        className: 'fa fa-image',
                        title: '이미지'
                    },
                    '|',
                    {
                        name: 'preview',
                        action: EasyMDE.togglePreview,
                        className: 'fa fa-eye no-disable',
                        title: '미리보기'
                    },
                    {
                        name: 'side-by-side',
                        action: EasyMDE.toggleSideBySide,
                        className: 'fa fa-columns no-disable no-mobile',
                        title: '분할 보기'
                    },
                    {
                        name: 'fullscreen',
                        action: EasyMDE.toggleFullScreen,
                        className: 'fa fa-arrows-alt no-disable no-mobile',
                        title: '전체 화면'
                    }
                ],
                previewRender: (markdownText: string) => {
                    return markdownText
                        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
                        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
                        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
                        .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
                        .replace(/\*(.*?)\*/gim, '<em>$1</em>')
                        .replace(/!\[(.*?)\]\((.*?)\)/gim, '<img alt="$1" src="$2" />')
                        .replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2">$1</a>')
                        .replace(/\n/gim, '<br />');
                },
                status: false,
                spellChecker: false
            });

            easyMDE.codemirror.on('change', () => {
                const newValue = easyMDE.value();
                setValue(newValue);
            });

            editor.current = easyMDE;
        }

        return () => {
            if (editor.current) {
                editor.current.toTextArea();
                editor.current = null;
            }
        };
    }, [textarea, initialValue, placeholder]);

    const handleUploadImage = async (image: File) => {
        if (!isImageFile(image)) {
            notification('이미지 파일이 아닙니다.', { type: 'error' });
            return;
        }

        try {
            const formData = new FormData();
            formData.append('image', image);

            const { data } = await http('v1/image', {
                method: 'POST',
                data: formData,
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (data.status === 'DONE' && editor.current) {
                const imageSrc = data.body.url;
                const imageMd = `![](${imageSrc})`;
                editor.current.codemirror.replaceSelection(imageMd);
            } else {
                notification('이미지 업로드에 실패했습니다.', { type: 'error' });
            }
        } catch (error) {
            notification('이미지 업로드에 실패했습니다.', { type: 'error' });
        }
    };

    const handleDropImage = async (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();

        const { files } = e.dataTransfer;
        if (files.length > 1) {
            notification('하나씩 업로드 할 수 있습니다.', { type: 'error' });
            return;
        }

        const [file] = Array.from(files);
        await handleUploadImage(file);
    };

    const handleSave = async () => {
        if (!username) {
            notification('사용자명이 필요합니다.', { type: 'error' });
            return;
        }

        setIsLoading(true);
        try {
            const { data } = await http(`v1/users/@${username}`, {
                method: 'PUT',
                data: {
                    about: true,
                    about_md: value
                }
            });

            if (data.status === 'DONE') {
                notification(successMessage, { type: 'success' });
                if (redirectPath) {
                    setTimeout(() => {
                        window.location.href = redirectPath;
                    }, 1000);
                }
            } else {
                notification(data.errorMessage || '업데이트에 실패했습니다.', { type: 'error' });
            }
        } catch (error) {
            notification('업데이트에 실패했습니다.', { type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const isImageFile = (file: File) => {
        const validTypes = [
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/gif'
        ];
        return validTypes.includes(file.type);
    };

    return (
        <div
            className="about-editor-container"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDropImage}
        >
            <input
                ref={imageInput}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                        handleUploadImage(e.target.files[0]);
                    }
                }}
            />
            <textarea
                ref={textarea}
                name="about_md"
                defaultValue={initialValue}
                style={{ display: 'none' }}
            />
            
            <div className="editor-actions">
                <button
                    className="save-button"
                    onClick={handleSave}
                    disabled={isLoading}
                >
                    {isLoading ? '저장 중...' : '작성 완료'}
                </button>
            </div>

            <style jsx>{`
                .about-editor-container {
                    position: relative;
                }

                .about-editor-container :global(.EasyMDEContainer) {
                    z-index: 1;
                    margin-bottom: 16px;
                }

                .about-editor-container :global(.CodeMirror) {
                    min-height: 400px;
                    border-radius: 4px;
                    border-color: #ced4da;
                }

                .about-editor-container :global(.CodeMirror-focused) {
                    border-color: #4568dc;
                    box-shadow: 0 0 0 0.2rem rgba(69, 104, 220, 0.25);
                }

                .about-editor-container :global(.editor-toolbar) {
                    border-color: #ced4da;
                    border-top-left-radius: 4px;
                    border-top-right-radius: 4px;
                }

                .about-editor-container :global(.editor-toolbar button) {
                    color: #495057;
                }

                .about-editor-container :global(.editor-toolbar button:hover),
                .about-editor-container :global(.editor-toolbar button.active) {
                    background: #e9ecef;
                    border-color: #ced4da;
                }

                .about-editor-container :global(.editor-preview) {
                    background: #fff;
                    padding: 10px;
                    overflow: auto;
                }

                .about-editor-container :global(.editor-preview-side) {
                    border-color: #ced4da;
                }

                .editor-actions {
                    display: flex;
                    justify-content: flex-end;
                    margin-top: 16px;
                }

                .save-button {
                    padding: 12px 24px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: transform 0.2s ease;
                }

                .save-button:hover:not(:disabled) {
                    transform: translateY(-2px);
                }

                .save-button:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                    transform: none;
                }
            `}</style>
        </div>
    );
};

export default AboutEditor;