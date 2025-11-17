import React, { useRef, useState } from 'react';

interface ImageUploaderProps {
    imagePreview: string | null;
    onImageUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onRemoveImage: () => void;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({
    imagePreview,
    onImageUpload,
    onRemoveImage
}) => {
    const imageInputRef = useRef<HTMLInputElement>(null);
    const [showUploader, setShowUploader] = useState(!!imagePreview);

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
                // Image preview - clean and minimal
                <div className="relative group">
                    <img src={imagePreview} alt="Cover" className="w-full rounded-xl" />
                    <button
                        type="button"
                        onClick={handleRemove}
                        className="absolute top-3 right-3 w-8 h-8 bg-black bg-opacity-60 hover:bg-opacity-90 text-white rounded-full flex items-center justify-center transition-all duration-200 opacity-0 group-hover:opacity-100">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            ) : showUploader && !imagePreview ? (
                // Upload area - simple and clean
                <div className="relative">
                    <label htmlFor="image" className="flex flex-col items-center justify-center w-full px-4 py-12 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-gray-300 hover:bg-gray-50 transition-all duration-200 group">
                        <svg className="w-10 h-10 text-gray-300 mb-3 group-hover:text-gray-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-sm text-gray-500 mb-1">커버 이미지 추가</span>
                        <span className="text-xs text-gray-400">클릭하거나 드래그하여 업로드</span>
                    </label>
                    <button
                        type="button"
                        onClick={() => setShowUploader(false)}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-gray-200 hover:bg-gray-300 text-gray-600 rounded-full flex items-center justify-center text-xs transition-colors">
                        ✕
                    </button>
                </div>
            ) : (
                // Compact button - Apple style
                <button
                    type="button"
                    onClick={() => setShowUploader(true)}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>커버 이미지 추가</span>
                </button>
            )}
        </div>
    );
};

export default ImageUploader;