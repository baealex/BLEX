import { useState } from 'react';

export const useImageUpload = () => {
    const [imagePreview, setImagePreview] = useState<string | null>(null);

    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                setImagePreview(e.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemoveImage = () => {
        setImagePreview(null);
    };

    const setImagePreviewUrl = (url: string | null) => {
        setImagePreview(url);
    };

    return {
        imagePreview,
        handleImageUpload,
        handleRemoveImage,
        setImagePreviewUrl
    };
};
