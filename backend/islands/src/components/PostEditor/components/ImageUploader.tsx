import React, { useRef } from 'react';

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

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6">
            <label className="block text-sm font-semibold text-slate-700 mb-4">커버 이미지</label>

            <div className="space-y-4">
                <label className="flex items-center justify-center gap-2 sm:gap-3 w-full px-3 sm:px-4 py-2 sm:py-3 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all duration-200">
                    <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span className="text-slate-600 font-medium text-sm sm:text-base">이미지 업로드</span>
                    <input
                        ref={imageInputRef}
                        type="file"
                        id="image"
                        name="image"
                        className="hidden"
                        accept="image/*"
                        onChange={onImageUpload}
                    />
                </label>

                {imagePreview && (
                    <div className="relative">
                        <img src={imagePreview} alt="Cover Image" className="w-full h-32 sm:h-48 object-cover rounded-lg" />
                        <button
                            type="button"
                            onClick={onRemoveImage}
                            className="absolute top-2 right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ImageUploader;