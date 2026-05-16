import { useCallback, useState } from 'react';

export const useImageUpload = () => {
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imageDeleted, setImageDeleted] = useState(false);

    const handleImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setImageFile(file);
            setImageDeleted(false);
            const reader = new FileReader();
            reader.onload = (e) => {
                setImagePreview(e.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    }, []);

    const handleRemoveImage = useCallback(() => {
        setImagePreview(null);
        setImageFile(null);
        setImageDeleted(true);
    }, []);

    const setImagePreviewUrl = useCallback((url: string | null) => {
        setImagePreview(url);
        setImageFile(null);
        setImageDeleted(false);
    }, []);

    const markImageSaved = useCallback(() => {
        setImageFile(null);
        setImageDeleted(false);
    }, []);

    return {
        imagePreview,
        imageFile,
        imageDeleted,
        handleImageUpload,
        handleRemoveImage,
        setImagePreviewUrl,
        markImageSaved
    };
};
