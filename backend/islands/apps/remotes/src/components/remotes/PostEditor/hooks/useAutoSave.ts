import { useCallback, useEffect, useRef, useState } from 'react';
import { createDraft, updateDraft } from '~/lib/api/posts';
import type { Response } from '~/lib/http.module';

interface AutoSaveData {
    title: string;
    content: string;
    tags: string;
    subtitle?: string;
    description?: string;
    seriesUrl?: string;
    customUrl?: string;
    coverLayout?: string;
    coverImagePosition?: string;
    coverImageRatio?: string;
    reservedDate?: string;
    imageFile?: File | null;
    imageDeleted?: boolean;
}

interface UseAutoSaveOptions {
    enabled: boolean;
    intervalMs?: number;
    draftUrl?: string;
    onSuccess?: (url?: string) => void;
    onError?: (error: Error) => void;
}

const buildDraftPayload = (data: AutoSaveData, useFormData: boolean) => {
    if (useFormData) {
        const formData = new FormData();
        formData.append('title', data.title || '제목 없음');
        formData.append('content', data.content);
        formData.append('tags', data.tags);
        if (data.subtitle) formData.append('subtitle', data.subtitle);
        if (data.description) formData.append('description', data.description);
        if (data.seriesUrl) formData.append('series_url', data.seriesUrl);
        if (data.customUrl) formData.append('custom_url', data.customUrl);
        if (data.coverLayout) formData.append('cover_layout', data.coverLayout);
        if (data.coverImagePosition) formData.append('cover_image_position', data.coverImagePosition);
        if (data.coverImageRatio) formData.append('cover_image_ratio', data.coverImageRatio);
        if (data.reservedDate !== undefined) formData.append('reserved_date', data.reservedDate);
        if (data.imageFile) formData.append('image', data.imageFile);
        if (data.imageDeleted) formData.append('image_delete', 'true');
        return formData;
    }

    return {
        title: data.title || '제목 없음',
        content: data.content,
        tags: data.tags,
        subtitle: data.subtitle,
        description: data.description,
        series_url: data.seriesUrl,
        custom_url: data.customUrl,
        cover_layout: data.coverLayout,
        cover_image_position: data.coverImagePosition,
        cover_image_ratio: data.coverImageRatio,
        reserved_date: data.reservedDate
    };
};

const ensureDraftSaved = (response: Response<{ url: string }>) => {
    if (response.status === 'DONE') {
        return response.body;
    }

    throw new Error(response.errorMessage || '임시저장에 실패했습니다.');
};

export const useAutoSave = (data: AutoSaveData, options: UseAutoSaveOptions) => {
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [hasSaveError, setHasSaveError] = useState(false);
    const [hasPendingChanges, setHasPendingChanges] = useState(false);
    const [autoSaveCountdown, setAutoSaveCountdown] = useState<number | null>(null);

    const autoSaveRef = useRef<number | null>(null);
    const countdownRef = useRef<number | null>(null);
    const dataRef = useRef(data);
    const optionsRef = useRef(options);
    const draftUrlRef = useRef<string | undefined>(options.draftUrl);
    const getContentSignature = useCallback((value: AutoSaveData) => JSON.stringify({
        title: value.title,
        content: value.content,
        tags: value.tags,
        subtitle: value.subtitle,
        description: value.description,
        seriesUrl: value.seriesUrl,
        customUrl: value.customUrl,
        coverLayout: value.coverLayout,
        coverImagePosition: value.coverImagePosition,
        coverImageRatio: value.coverImageRatio,
        reservedDate: value.reservedDate
    }), []);

    const getDataSignature = useCallback((value: AutoSaveData) => JSON.stringify({
        content: JSON.parse(getContentSignature(value)),
        imageDeleted: value.imageDeleted,
        imageFile: value.imageFile ? {
            name: value.imageFile.name,
            size: value.imageFile.size,
            lastModified: value.imageFile.lastModified
        } : null
    }), [getContentSignature]);

    const prevDataStringRef = useRef<string>(getDataSignature(data));
    const prevContentStringRef = useRef<string>(getContentSignature(data));
    const skipNextImageResetRef = useRef(false);
    const isInitialLoadRef = useRef(true);

    dataRef.current = data;
    optionsRef.current = options;

    // Keep draftUrlRef in sync with options
    useEffect(() => {
        if (options.draftUrl) {
            draftUrlRef.current = options.draftUrl;
        }
    }, [options.draftUrl]);

    const { intervalMs = 3000 } = options;

    const currentDataString = getDataSignature(data);
    const currentContentString = getContentSignature(data);

    // Manual save - returns true on success, false on failure
    const manualSave = useCallback(async (): Promise<boolean> => {
        const currentData = dataRef.current;
        const currentOptions = optionsRef.current;

        if (isSaving || !currentOptions.enabled) return false;

        // Clear existing timer and countdown when manually saving
        if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
        if (countdownRef.current) clearInterval(countdownRef.current);
        setAutoSaveCountdown(null);

        const needsFormData = !!currentData.imageFile || !!currentData.imageDeleted;

        setIsSaving(true);
        try {
            const payload = buildDraftPayload(currentData, needsFormData);

            if (draftUrlRef.current) {
                const response = await updateDraft(draftUrlRef.current, payload);
                const body = ensureDraftSaved(response.data);
                // Update draftUrlRef if URL changed (e.g. custom_url was applied)
                if (body.url) {
                    const newUrl = body.url;
                    if (newUrl !== draftUrlRef.current) {
                        draftUrlRef.current = newUrl;
                        currentOptions.onSuccess?.(newUrl);
                    }
                }
            } else {
                const response = await createDraft(payload);
                const body = ensureDraftSaved(response.data);
                const url = body.url;
                if (url) {
                    draftUrlRef.current = url;
                }
                currentOptions.onSuccess?.(url);
            }

            setLastSaved(new Date());
            setHasSaveError(false);
            setHasPendingChanges(false);
            // Update previous data to prevent auto-save from triggering immediately
            prevDataStringRef.current = getDataSignature(currentData);
            prevContentStringRef.current = getContentSignature(currentData);
            skipNextImageResetRef.current = true;
            currentOptions.onSuccess?.();
            return true;
        } catch (error) {
            setHasSaveError(true);
            currentOptions.onError?.(error as Error);
            return false;
        } finally {
            setIsSaving(false);
        }
    }, [isSaving, getDataSignature, getContentSignature]);

    // Auto-save effect
    useEffect(() => {
        if (!options.enabled) return;

        // Check if data has actually changed
        if (prevDataStringRef.current === currentDataString) return;

        if (skipNextImageResetRef.current && prevContentStringRef.current === currentContentString) {
            skipNextImageResetRef.current = false;
            prevDataStringRef.current = currentDataString;
            return;
        }

        skipNextImageResetRef.current = false;

        // Skip initial load trigger - when data changes from empty to loaded
        if (isInitialLoadRef.current) {
            const prevData = JSON.parse(prevContentStringRef.current);
            const wasEmpty = !prevData.title && !prevData.content && !prevData.tags && !prevData.customUrl;

            if (wasEmpty) {
                isInitialLoadRef.current = false;
                prevDataStringRef.current = currentDataString;
                prevContentStringRef.current = currentContentString;
                return;
            }
        }

        isInitialLoadRef.current = false;

        prevDataStringRef.current = currentDataString;
        prevContentStringRef.current = currentContentString;
        setHasPendingChanges(true);

        if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
        if (countdownRef.current) clearInterval(countdownRef.current);

        // Start countdown
        const totalSeconds = Math.ceil(intervalMs / 1000);
        setAutoSaveCountdown(totalSeconds);
        countdownRef.current = window.setInterval(() => {
            setAutoSaveCountdown(prev => {
                if (prev === null || prev <= 1) return null;
                return prev - 1;
            });
        }, 1000);

        autoSaveRef.current = window.setTimeout(() => {
            if (countdownRef.current) clearInterval(countdownRef.current);
            setAutoSaveCountdown(null);

            const currentData = dataRef.current;
            if (currentData.title || currentData.content) {
                manualSave();
            }
        }, intervalMs);

        return () => {
            if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
            if (countdownRef.current) clearInterval(countdownRef.current);
        };
    }, [currentDataString, currentContentString, options.enabled, intervalMs, manualSave]);

    return {
        lastSaved,
        isSaving,
        hasSaveError,
        hasPendingChanges,
        autoSaveCountdown,
        manualSave
    };
};
