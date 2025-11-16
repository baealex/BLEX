import React, { useRef } from 'react';
import TiptapEditor from '../../../shared/TiptapEditor';
import ImageUploader from './ImageUploader';
import TagManager from './TagManager';
import DangerZone from './DangerZone';

interface PostFormData {
    title: string;
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
    onContentChange: (content: string) => void;
    onTagsChange: (tags: string[]) => void;
    onImageUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onRemoveImage: () => void;
    onDelete?: () => void;

    // Form submission
    getCsrfToken: () => string;
}

const PostForm: React.FC<PostFormProps> = ({
    formRef: externalFormRef,
    isLoading,
    isEdit,
    formData,
    tags,
    imagePreview,
    selectedSeries,
    onTitleChange,
    onContentChange,
    onTagsChange,
    onImageUpload,
    onRemoveImage,
    onDelete,
    getCsrfToken
}) => {
    const internalFormRef = useRef<HTMLFormElement>(null);
    const formRef = externalFormRef || internalFormRef;

    return (
        <form ref={formRef} method="POST" encType="multipart/form-data">
            <input type="hidden" name="csrfmiddlewaretoken" value={getCsrfToken()} />

            {/* Main Content Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8 mb-4">
                {/* Title */}
                <label htmlFor="title" className="sr-only">제목</label>
                <input
                    type="text"
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={(e) => onTitleChange(e.target.value)}
                    className="w-full px-0 py-0 mb-8 border-0 focus:ring-0 text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 placeholder-gray-300 leading-tight"
                    placeholder="제목"
                    required
                />

                {/* Image Upload */}
                <ImageUploader
                    imagePreview={imagePreview}
                    onImageUpload={onImageUpload}
                    onRemoveImage={onRemoveImage}
                />

                {/* Content Editor */}
                <div>
                    <label htmlFor="content" className="sr-only">내용</label>
                    {!isLoading && (
                        <TiptapEditor
                            name="text_md"
                            content={formData.content}
                            onChange={onContentChange}
                            height="500px"
                            placeholder="내용을 입력하세요..."
                        />
                    )}
                </div>

                {/* Tags - Editable */}
                <div className="mt-8 pt-6 border-t border-gray-100">
                    <TagManager tags={tags} onTagsChange={onTagsChange} />
                </div>
            </div>

            {/* Hidden fields for form submission */}
            <div className="hidden">
                <input type="hidden" name="url" value={formData.url} />
                <input type="hidden" name="meta_description" value={formData.metaDescription} />
                <input type="hidden" name="hide" value={formData.hide ? 'true' : 'false'} />
                <input type="hidden" name="notice" value={formData.notice ? 'true' : 'false'} />
                <input type="hidden" name="advertise" value={formData.advertise ? 'true' : 'false'} />
                {tags.map((tag, index) => (
                    <input key={index} type="hidden" name="tag" value={tag} />
                ))}
                {selectedSeries.id && <input type="hidden" name="series" value={selectedSeries.id} />}
            </div>

            {/* Danger Zone */}
            {isEdit && onDelete && (
                <div className="mt-12">
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
