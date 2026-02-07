import React, { useRef } from 'react';
import { TiptapEditor } from '~/components/shared';
import ImageUploader from './ImageUploader';
import TagManager from './TagManager';
import DangerZone from './DangerZone';

interface PostFormData {
    title: string;
    subtitle: string;
    url: string;
    content: string;
    metaDescription: string;
    hide: boolean;
    notice: boolean;
    advertise: boolean;
}

interface PostFormProps {
    formRef?: React.RefObject<HTMLFormElement | null>;
    isLoading: boolean;
    isEdit: boolean;
    formData: PostFormData;
    tags: string[];
    imagePreview: string | null;
    selectedSeries: { id: string; name: string };

    // Handlers
    onTitleChange: (title: string) => void;
    onSubtitleChange: (subtitle: string) => void;
    onContentChange: (content: string) => void;
    onTagsChange: (tags: string[]) => void;
    onImageUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onEditorImageUpload?: (file: File) => Promise<string | undefined>;
    onRemoveImage: () => void;
    onDelete?: () => void;

    // Form submission
    getCsrfToken: () => string;
}

const PostForm = ({
    formRef: externalFormRef,
    isLoading,
    isEdit,
    formData,
    tags,
    imagePreview,
    selectedSeries,
    onTitleChange,
    onSubtitleChange,
    onContentChange,
    onTagsChange,
    onImageUpload,
    onEditorImageUpload,
    onRemoveImage,
    onDelete,
    getCsrfToken
}: PostFormProps) => {
    const internalFormRef = useRef<HTMLFormElement>(null);
    const formRef = externalFormRef || internalFormRef;

    return (
        <form ref={formRef} method="POST" encType="multipart/form-data">
            <input type="hidden" name="csrfmiddlewaretoken" value={getCsrfToken()} />

            <article>
                <div className="mb-8">
                    <label htmlFor="title" className="sr-only">제목</label>
                    <input
                        type="text"
                        id="title"
                        name="title"
                        value={formData.title}
                        onChange={(e) => onTitleChange(e.target.value)}
                        className="w-full px-0 py-0 border-0 focus:ring-0 text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 placeholder-gray-300 leading-tight tracking-tight break-words"
                        placeholder="제목을 입력하세요"
                        required
                    />
                    <input
                        type="text"
                        name="subtitle"
                        value={formData.subtitle}
                        onChange={(e) => onSubtitleChange(e.target.value)}
                        className="w-full px-0 py-0 border-0 focus:ring-0 text-lg sm:text-xl text-gray-500 placeholder-gray-300 leading-tight mt-2"
                        placeholder="부제목 (선택사항)"
                    />
                </div>

                <ImageUploader
                    imagePreview={imagePreview}
                    onImageUpload={onImageUpload}
                    onRemoveImage={onRemoveImage}
                />

                <div className="mb-8">
                    <label htmlFor="content" className="sr-only">내용</label>
                    {!isLoading && (
                        <TiptapEditor
                            name="text_md"
                            content={formData.content}
                            onChange={onContentChange}
                            placeholder="내용을 입력하세요"
                            onImageUpload={onEditorImageUpload}
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
                <input type="hidden" name="notice" value={formData.notice ? 'true' : 'false'} />
                <input type="hidden" name="advertise" value={formData.advertise ? 'true' : 'false'} />
                <input type="hidden" name="tag" value={tags.join(',')} />
                {selectedSeries.id && <input type="hidden" name="series" value={selectedSeries.id} />}
            </div>

            {isEdit && onDelete && (
                <div className="mb-16">
                    <DangerZone
                        isSubmitting={false}
                        onDelete={onDelete}
                    />
                </div>
            )}
        </form>
    );
};

export default PostForm;
