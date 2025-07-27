import React, { useState, useEffect, useRef } from 'react';
import { http } from '~/modules/http.module';
import { notification } from '@baejino/ui';
import EasyMDE from 'easymde';

import 'easymde/dist/easymde.min.css';

interface EditorProps {
    name: string;
    content?: string;
    editable?: boolean;
    onChange?: (value: string) => void;
    height?: string;
    placeholder?: string;
}

interface YoutubeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUpload: (id: string) => void;
}

const YoutubeModal: React.FC<YoutubeModalProps> = ({ isOpen, onClose, onUpload }) => {
    const [youtubeId, setYoutubeId] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (youtubeId) {
            onUpload(youtubeId);
            setYoutubeId('');
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h3>YouTube 영상 추가</h3>
                    <button className="close-button" onClick={onClose}>
                        &times;
                    </button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="youtube-id">YouTube 영상 ID 또는 URL</label>
                        <input
                            id="youtube-id"
                            type="text"
                            value={youtubeId}
                            onChange={(e) => {
                                let id = e.target.value;
                                // Extract ID from URL if needed
                                if (id.includes('youtube.com') || id.includes('youtu.be')) {
                                    const match = id.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
                                    if (match && match[1]) {
                                        id = match[1];
                                    }
                                }
                                setYoutubeId(id);
                            }}
                            placeholder="dQw4w9WgXcQ 또는 https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                            className="form-control"
                        />
                    </div>
                    <div className="form-actions">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>
                            취소
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={!youtubeId}>
                            추가
                        </button>
                    </div>
                </form>
            </div>

            <style jsx>{`
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-color: rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                }

                .modal-content {
                    background-color: white;
                    border-radius: 8px;
                    width: 90%;
                    max-width: 500px;
                    padding: 20px;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                }

                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 16px;
                }

                .modal-header h3 {
                    margin: 0;
                    font-size: 18px;
                }

                .close-button {
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #6c757d;
                }

                .form-group {
                    margin-bottom: 16px;
                }

                .form-group label {
                    display: block;
                    margin-bottom: 8px;
                    font-weight: 500;
                }

                .form-control {
                    width: 100%;
                    padding: 8px 12px;
                    border: 1px solid #ced4da;
                    border-radius: 4px;
                    font-size: 16px;
                }

                .form-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 8px;
                }
            `}</style>
        </div>
    );
};

const MarkdownEditor: React.FC<EditorProps> = ({
    name,
    content = '',
    editable = true,
    onChange,
    height = 'auto',
    placeholder = '마크다운으로 작성할 수 있어요.'
}) => {
    const [value, setValue] = useState(content);
    const [isYoutubeModalOpen, setIsYoutubeModalOpen] = useState(false);
    // Track preview state for potential future enhancements
    const [, setIsPreview] = useState(false);
    const editor = useRef<EasyMDE | null>(null);
    const textarea = useRef<HTMLTextAreaElement>(null);
    const imageInput = useRef<HTMLInputElement>(null);
    const detectPreview = useRef<ReturnType<typeof setTimeout>>();

    useEffect(() => {
        if (textarea.current && !editor.current) {
            const easyMDE = new EasyMDE({
                element: textarea.current,
                autoDownloadFontAwesome: false,
                initialValue: content,
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
                    {
                        name: 'youtube',
                        action: () => {
                            setIsYoutubeModalOpen(true);
                        },
                        className: 'fab fa-youtube',
                        title: 'YouTube'
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
                    // Simple markdown rendering for preview
                    // In a real implementation, you would use a proper markdown renderer
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
                if (onChange) {
                    onChange(newValue);
                }
            });

            editor.current = easyMDE;
        }

        return () => {
            if (editor.current) {
                editor.current.toTextArea();
                editor.current = null;
            }
            if (detectPreview.current) {
                clearTimeout(detectPreview.current);
            }
        };
    }, [textarea, content, onChange, placeholder]);

    useEffect(() => {
        const detect = () => {
            setIsPreview(editor.current?.isPreviewActive() || false);
            detectPreview.current = setTimeout(detect, 100);
        };
        detectPreview.current = setTimeout(detect, 100);

        return () => {
            if (detectPreview.current) {
                clearTimeout(detectPreview.current);
            }
        };
    }, []);

    useEffect(() => {
        if (editor.current) {
            if (editor.current.value() !== value) {
                editor.current.value(value);
            }
        }
    }, [value]);

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
                const imageMd = imageSrc.includes('.mp4')
                    ? `@gif[${imageSrc}]`
                    : `![](${imageSrc})`;
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

    const handleYoutubeUpload = (id: string) => {
        if (id && editor.current) {
            const youtubeMd = `@youtube[${id}]`;
            editor.current.codemirror.replaceSelection(youtubeMd);
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
            className="markdown-editor-container"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDropImage}>
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
                name={name}
                defaultValue={content}
                readOnly={!editable}
                style={{ display: 'none' }}
            />
            <YoutubeModal
                isOpen={isYoutubeModalOpen}
                onClose={() => setIsYoutubeModalOpen(false)}
                onUpload={handleYoutubeUpload}
            />

            <style jsx>{`
                .markdown-editor-container {
                    position: relative;
                }

                .markdown-editor-container :global(.EasyMDEContainer) {
                    z-index: 1;
                }

                .markdown-editor-container :global(.CodeMirror) {
                    height: ${height};
                    border-radius: 4px;
                    border-color: #ced4da;
                }

                .markdown-editor-container :global(.CodeMirror-focused) {
                    border-color: #4568dc;
                    box-shadow: 0 0 0 0.2rem rgba(69, 104, 220, 0.25);
                }

                .markdown-editor-container :global(.editor-toolbar) {
                    border-color: #ced4da;
                    border-top-left-radius: 4px;
                    border-top-right-radius: 4px;
                }

                .markdown-editor-container :global(.editor-toolbar button) {
                    color: #495057;
                }

                .markdown-editor-container :global(.editor-toolbar button:hover),
                .markdown-editor-container :global(.editor-toolbar button.active) {
                    background: #e9ecef;
                    border-color: #ced4da;
                }

                .markdown-editor-container :global(.editor-preview) {
                    background: #fff;
                    padding: 10px;
                    overflow: auto;
                }

                .markdown-editor-container :global(.editor-preview-side) {
                    border-color: #ced4da;
                }
            `}</style>
        </div>
    );
};

export default MarkdownEditor;
