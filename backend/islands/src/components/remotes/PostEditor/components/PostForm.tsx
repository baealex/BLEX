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
        <form ref={formRef} method="POST" encType="multipart/form-data" className="space-y-6 sm:space-y-8">
            <input type="hidden" name="csrfmiddlewaretoken" value={getCsrfToken()} />

            {/* Title */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
                <label htmlFor="title" className="block text-sm font-semibold text-gray-700 mb-2">제목</label>
                <input
                    type="text"
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={(e) => onTitleChange(e.target.value)}
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-solid border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent text-base sm:text-lg placeholder-slate-400"
                    placeholder="게시글 제목을 입력하세요..."
                    required
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
                {/* Main Editor */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
                        <label htmlFor="content" className="block text-sm font-semibold text-gray-700 mb-4">내용</label>
                        {!isLoading && (
                            <TiptapEditor
                                name="text_md"
                                content={formData.content}
                                onChange={onContentChange}
                                height="500px"
                                placeholder="게시글을 작성해주세요..."
                            />
                        )}
                    </div>
                </div>

                {/* Sidebar */}
                <div className="lg:col-span-1 space-y-6">
                    {/* URL */}
                    {!isEdit && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
                            <label htmlFor="url" className="block text-sm font-semibold text-gray-700 mb-2">URL 주소</label>
                            <input
                                type="text"
                                id="url"
                                name="url"
                                value={formData.url}
                                onChange={(e) => onUrlChange(e.target.value)}
                                className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-solid border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent text-sm sm:text-base"
                                placeholder="게시글-url-주소"
                                required
                            />
                            <small className="text-gray-500 mt-2 block">URL이 중복되면 자동으로 번호가 추가됩니다.</small>
                        </div>
                    )}

                    <ImageUploader
                        imagePreview={imagePreview}
                        onImageUpload={onImageUpload}
                        onRemoveImage={onRemoveImage}
                    />

                    {/* Meta Description */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
                        <label htmlFor="meta_description" className="block text-sm font-semibold text-gray-700 mb-2">메타 설명</label>
                        <textarea
                            id="meta_description"
                            name="meta_description"
                            value={formData.metaDescription}
                            onChange={(e) => onMetaDescriptionChange(e.target.value)}
                            className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-solid border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent resize-none text-sm sm:text-base"
                            rows={3}
                            maxLength={150}
                            placeholder="SEO를 위한 간단한 설명..."
                        />
                        <div className="flex justify-between items-center mt-2">
                            <small className="text-gray-500">검색엔진을 위한 SEO 설명</small>
                            <small className="text-gray-400">{formData.metaDescription.length}/150</small>
                        </div>
                    </div>

                    <TagManager tags={tags} onTagsChange={onTagsChange} />

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
            </div>
        </form>
    );
};

export default PostForm;
