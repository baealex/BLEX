import React, { useRef } from 'react';
import { useLingui } from '@lingui/react/macro';
import { TiptapEditor } from '~/components/shared';
import { getCsrfToken } from '~/utils/csrf';
import TagManager from './TagManager';
import PostCoverEditor from './PostCoverEditor';

interface PostFormData {
    title: string;
    subtitle: string;
    url: string;
    content: string;
    metaDescription: string;
    hide: boolean;
    advertise: boolean;
    allowComments: boolean;
    coverLayout: string;
    coverImagePosition: string;
    coverImageRatio: string;
}

interface PostFormProps {
    beforeContent?: React.ReactNode;
    formRef?: React.RefObject<HTMLFormElement | null>;
    isLoading: boolean;
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
    onEditorImageUploadError?: (errorMessage: string) => void;
    onEditorUploadStateChange?: (isUploading: boolean) => void;
    onRemoveImage: () => void;
}

const PostForm = ({
    beforeContent,
    formRef: externalFormRef,
    isLoading,
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
    onEditorImageUploadError,
    onEditorUploadStateChange,
    onRemoveImage
}: PostFormProps) => {
    const { i18n, t } = useLingui();
    const internalFormRef = useRef<HTMLFormElement>(null);
    const formRef = externalFormRef || internalFormRef;

    return (
        <form ref={formRef} method="POST" encType="multipart/form-data">
            <input type="hidden" name="csrfmiddlewaretoken" value={getCsrfToken()} />

            <article>
                <PostCoverEditor
                    formData={formData}
                    imagePreview={imagePreview}
                    onTitleChange={onTitleChange}
                    onSubtitleChange={onSubtitleChange}
                    onImageUpload={onImageUpload}
                    onRemoveImage={onRemoveImage}
                />

                {beforeContent}

                <div className="mb-8">
                    <label htmlFor="content" className="sr-only">
                        {t({
                            id: 'editor.fields.content',
                            message: 'Content'
                        })}
                    </label>
                    {!isLoading && (
                        <TiptapEditor
                            name="content_html"
                            content={formData.content}
                            locale={i18n.locale}
                            onChange={onContentChange}
                            placeholder={t({
                                id: 'editor.fields.content_placeholder',
                                message: 'Start writing...'
                            })}
                            onImageUpload={onEditorImageUpload}
                            onImageUploadError={onEditorImageUploadError}
                            onUploadStateChange={onEditorUploadStateChange}
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
                <input type="hidden" name="block_comment" value={formData.allowComments ? 'false' : 'true'} />
                <input type="hidden" name="tag" value={tags.join(',')} />
                {selectedSeries.id && <input type="hidden" name="series" value={selectedSeries.id} />}
            </div>
        </form>
    );
};

export default PostForm;
