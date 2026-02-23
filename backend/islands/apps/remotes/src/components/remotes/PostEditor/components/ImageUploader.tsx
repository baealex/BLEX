import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@blex/ui/button';
import { IconButton } from '@blex/ui/icon-button';
import { Image, X } from '@blex/ui/icons';

interface ImageUploaderProps {
    imagePreview: string | null;
    onImageUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onRemoveImage: () => void;
}

const ImageUploader = ({
    imagePreview,
    onImageUpload,
    onRemoveImage
}: ImageUploaderProps) => {
    const imageInputRef = useRef<HTMLInputElement>(null);
    const [showUploader, setShowUploader] = useState(!!imagePreview);

    // Sync showUploader when imagePreview is set externally (e.g. draft restore)
    useEffect(() => {
        if (imagePreview) {
            setShowUploader(true);
        }
    }, [imagePreview]);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onImageUpload(e);
        setShowUploader(true);
    };

    const handleRemove = () => {
        onRemoveImage();
        setShowUploader(false);
        if (imageInputRef.current) {
            imageInputRef.current.value = '';
        }
    };

    return (
        <div className="mb-6">
            {/* File input - always rendered but hidden */}
            <input
                ref={imageInputRef}
                type="file"
                id="image"
                name="image"
                className="hidden"
                accept="image/*"
                onChange={handleImageChange}
            />

            {showUploader && imagePreview ? (
                <div className="mb-12 sm:mb-16 relative group">
                    <img src={imagePreview} alt="Cover" className="w-full rounded-3xl shadow-2xl shadow-subtle" />
                    <button
                        type="button"
                        onClick={handleRemove}
                        className="absolute top-4 right-4 w-10 h-10 bg-action bg-opacity-60 hover:bg-opacity-90 text-content-inverted rounded-full flex items-center justify-center transition-all duration-200 sm:opacity-0 sm:group-hover:opacity-100"
                        aria-label="커버 이미지 삭제">
                        <X className="w-5 h-5" />
                    </button>
                </div>
            ) : showUploader && !imagePreview ? (
                <div className="relative">
                    <label htmlFor="image" className="flex flex-col items-center justify-center w-full px-4 py-12 border-2 border-dashed border-line rounded-xl cursor-pointer hover:border-line hover:bg-surface-subtle transition-all duration-200 group">
                        <Image className="w-10 h-10 text-content-hint mb-3 group-hover:text-content-hint transition-colors" />
                        <span className="text-sm text-content-secondary mb-1">커버 이미지 추가</span>
                        <span className="text-xs text-content-hint">클릭하여 업로드</span>
                    </label>
                    <IconButton
                        size="sm"
                        rounded="full"
                        onClick={() => setShowUploader(false)}
                        className="absolute -top-2 -right-2 !w-6 !h-6 !bg-line hover:!bg-line-strong !text-content-secondary"
                        aria-label="업로더 닫기">
                        <X className="w-3 h-3" />
                    </IconButton>
                </div>
            ) : (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowUploader(true)}
                    leftIcon={<Image className="w-4 h-4" />}>
                    커버 이미지 추가
                </Button>
            )}
        </div>
    );
};

export default ImageUploader;
