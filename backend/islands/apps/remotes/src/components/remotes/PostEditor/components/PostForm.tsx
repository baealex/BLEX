import React, { useRef } from 'react';
import { TiptapEditor } from '~/components/shared';
import { getCsrfToken } from '~/utils/csrf';
import ImageUploader from './ImageUploader';
import TagManager from './TagManager';
import type { ContentType } from '../types';

interface PostFormData {
    title: string;
    subtitle: string;
    url: string;
    content: string;
    metaDescription: string;
    hide: boolean;
    advertise: boolean;
}

interface PostFormProps {
    formRef?: React.RefObject<HTMLFormElement | null>;
    isLoading: boolean;
    formData: PostFormData;
    tags: string[];
    imagePreview: string | null;
    selectedSeries: { id: string; name: string };
    contentType: ContentType;
    onContentTypeChange: (type: ContentType) => void;
    isContentTypeChangeable: boolean;

    // Handlers
    onTitleChange: (title: string) => void;
    onSubtitleChange: (subtitle: string) => void;
    onContentChange: (content: string) => void;
    onTagsChange: (tags: string[]) => void;
    onImageUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onEditorImageUpload?: (file: File) => Promise<string | undefined>;
    onRemoveImage: () => void;
}

const PostForm = ({
    formRef: externalFormRef,
    isLoading,
    formData,
    tags,
    imagePreview,
    selectedSeries,
    contentType,
    onContentTypeChange,
    isContentTypeChangeable,
    onTitleChange,
    onSubtitleChange,
    onContentChange,
    onTagsChange,
    onImageUpload,
    onEditorImageUpload,
    onRemoveImage
}: PostFormProps) => {
    const internalFormRef = useRef<HTMLFormElement>(null);
    const formRef = externalFormRef || internalFormRef;

    return (
        <form ref={formRef} method="POST" encType="multipart/form-data">
            <input type="hidden" name="csrfmiddlewaretoken" value={getCsrfToken()} />
            <input type="hidden" name="content_type" value={contentType} />

            <article>
                <div className="mb-8">
                    <label htmlFor="title" className="sr-only">제목</label>
                    <input
                        type="text"
                        id="title"
                        name="title"
                        value={formData.title}
                        onChange={(e) => onTitleChange(e.target.value)}
                        maxLength={65}
                        className="w-full px-0 py-0 border-0 focus:ring-0 text-2xl sm:text-3xl lg:text-4xl font-bold text-content placeholder-content-hint leading-tight tracking-tight break-words"
                        placeholder="제목을 입력하세요"
                        required
                    />
                    {formData.title.length > 50 && (
                        <p className={`text-xs mt-1 ${formData.title.length >= 65 ? 'text-danger' : 'text-content-hint'}`}>
                            {formData.title.length}/65
                        </p>
                    )}
                    <input
                        type="text"
                        name="subtitle"
                        value={formData.subtitle}
                        onChange={(e) => onSubtitleChange(e.target.value)}
                        className="w-full px-0 py-0 border-0 focus:ring-0 text-lg sm:text-xl text-content-secondary placeholder-content-hint leading-tight mt-2"
                        placeholder="부제목 (선택사항)"
                    />
                </div>

                <ImageUploader
                    imagePreview={imagePreview}
                    onImageUpload={onImageUpload}
                    onRemoveImage={onRemoveImage}
                />

                <div className="mb-8">
                    <div className="flex items-center gap-1 mb-3">
                        <button
                            type="button"
                            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                                contentType === 'html'
                                    ? 'bg-action text-content-inverted'
                                    : 'bg-surface-subtle text-content-secondary hover:bg-line'
                            } ${!isContentTypeChangeable && contentType !== 'html' ? 'opacity-50 cursor-not-allowed' : ''}`}
                            disabled={!isContentTypeChangeable && contentType !== 'html'}
                            onClick={() => onContentTypeChange('html')}>
                            WYSIWYG
                        </button>
                        <button
                            type="button"
                            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                                contentType === 'markdown'
                                    ? 'bg-action text-content-inverted'
                                    : 'bg-surface-subtle text-content-secondary hover:bg-line'
                            } ${!isContentTypeChangeable && contentType !== 'markdown' ? 'opacity-50 cursor-not-allowed' : ''}`}
                            disabled={!isContentTypeChangeable && contentType !== 'markdown'}
                            onClick={() => onContentTypeChange('markdown')}>
                            Markdown
                        </button>
                    </div>

                    <label htmlFor="content" className="sr-only">내용</label>
                    {!isLoading && contentType === 'html' && (
                        <TiptapEditor
                            name="text_md"
                            content={formData.content}
                            onChange={onContentChange}
                            placeholder="내용을 입력하세요"
                            onImageUpload={onEditorImageUpload}
                        />
                    )}
                    {!isLoading && contentType === 'markdown' && (
                        <textarea
                            name="text_md"
                            value={formData.content}
                            onChange={(e) => onContentChange(e.target.value)}
                            placeholder="마크다운으로 작성하세요..."
                            className="w-full min-h-[500px] px-4 py-3 border border-line rounded-lg font-mono text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-line-strong focus:border-transparent"
                            spellCheck={false}
                        />
                    )}
                </div>

                <div className="mb-4">
                    <TagManager tags={tags} onTagsChange={onTagsChange} />
                </div>
            </article>

            <div className="hidden">
                <input type="hidden" name="url" value={formData.url} />
                <input type="hidden" name="meta_description" value={formData.metaDescription} />
                <input type="hidden" name="hide" value={formData.hide ? 'true' : 'false'} />
                <input type="hidden" name="advertise" value={formData.advertise ? 'true' : 'false'} />
                <input type="hidden" name="tag" value={tags.join(',')} />
                {selectedSeries.id && <input type="hidden" name="series" value={selectedSeries.id} />}
            </div>
        </form>
    );
};

export default PostForm;
