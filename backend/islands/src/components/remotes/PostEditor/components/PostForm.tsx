import React, { useRef } from 'react';
import TiptapEditor from '../../TiptapEditor/TiptapEditor';
import TagManager from './TagManager';
import SeriesSelector from './SeriesSelector';
import ImageUploader from './ImageUploader';
import PostSettings from './PostSettings';
import DangerZone from './DangerZone';

interface Series {
    id: string;
    name: string;
}

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
    seriesList: Series[];

    // Handlers
    onTitleChange: (title: string) => void;
    onUrlChange: (url: string) => void;
    onContentChange: (content: string) => void;
    onMetaDescriptionChange: (description: string) => void;
    onTagsChange: (tags: string[]) => void;
    onImageUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onRemoveImage: () => void;
    onSeriesChange: (series: { id: string; name: string }) => void;
    onFormDataChange: (field: string, value: boolean) => void;
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
    seriesList,
    onTitleChange,
    onUrlChange,
    onContentChange,
    onMetaDescriptionChange,
    onTagsChange,
    onImageUpload,
    onRemoveImage,
    onSeriesChange,
    onFormDataChange,
    onDelete,
    getCsrfToken
}) => {
    const internalFormRef = useRef<HTMLFormElement>(null);
    const formRef = externalFormRef || internalFormRef;

    return (
        <form ref={formRef} method="POST" encType="multipart/form-data" className="space-y-4">
            <input type="hidden" name="csrfmiddlewaretoken" value={getCsrfToken()} />

            {/* Unified Content Card - Apple-style clean layout */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8">
                {/* Title - Large and prominent */}
                <label htmlFor="title" className="sr-only">제목</label>
                <input
                    type="text"
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={(e) => onTitleChange(e.target.value)}
                    className="w-full px-0 py-0 mb-6 border-0 focus:ring-0 text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 placeholder-gray-300 leading-tight"
                    placeholder="제목"
                    required
                />

                {/* Image Upload - Optional, between title and content */}
                <ImageUploader
                    imagePreview={imagePreview}
                    onImageUpload={onImageUpload}
                    onRemoveImage={onRemoveImage}
                />

                {/* Content Editor - Main focus */}
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

                {/* Tags - Clean inline style at bottom */}
                <div className="mt-6 pt-6 border-t border-gray-100">
                    <TagManager tags={tags} onTagsChange={onTagsChange} />
                </div>
            </div>

            {/* Metadata & Settings - Collapsible clean cards */}
            <div className="space-y-3">
                {/* URL - Only for new posts */}
                {!isEdit && (
                    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
                        <label htmlFor="url" className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">URL</label>
                        <input
                            type="text"
                            id="url"
                            name="url"
                            value={formData.url}
                            onChange={(e) => onUrlChange(e.target.value)}
                            className="w-full px-3 py-2 border border-solid border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-transparent text-sm"
                            placeholder="게시글-url"
                            required
                        />
                        <p className="text-xs text-gray-400 mt-2">중복 시 자동으로 번호가 추가됩니다</p>
                    </div>
                )}

                {/* Meta Description */}
                <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
                    <label htmlFor="meta_description" className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                        SEO 설명
                    </label>
                    <textarea
                        id="meta_description"
                        name="meta_description"
                        value={formData.metaDescription}
                        onChange={(e) => onMetaDescriptionChange(e.target.value)}
                        className="w-full px-3 py-2 border border-solid border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-transparent resize-none text-sm"
                        rows={2}
                        maxLength={150}
                        placeholder="검색 엔진을 위한 설명..."
                    />
                    <p className="text-xs text-gray-400 mt-2 text-right">{formData.metaDescription.length}/150</p>
                </div>

                {/* Series & Settings - Combined for cleaner look */}
                <SeriesSelector
                    seriesList={seriesList}
                    selectedSeries={selectedSeries}
                    onSeriesChange={onSeriesChange}
                />

                <PostSettings
                    formData={formData}
                    onChange={onFormDataChange}
                />

                {/* Danger Zone */}
                {isEdit && onDelete && (
                    <DangerZone
                        isSubmitting={false}
                        onDelete={onDelete}
                    />
                )}
            </div>
        </form>
    );
};

export default PostForm;
