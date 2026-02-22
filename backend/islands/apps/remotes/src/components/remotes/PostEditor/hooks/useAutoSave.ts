import { useCallback, useEffect, useRef, useState } from 'react';
import { createDraft, updateDraft } from '~/lib/api/posts';

interface AutoSaveData {
    title: string;
    content: string;
    tags: string;
    subtitle?: string;
    description?: string;
    seriesUrl?: string;
    customUrl?: string;
    contentType?: string;
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
        if (data.contentType) formData.append('content_type', data.contentType);
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
        content_type: data.contentType
    };
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
    const prevDataStringRef = useRef<string>(JSON.stringify({
        title: data.title,
        content: data.content,
        tags: data.tags,
        customUrl: data.customUrl
    }));
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

    // Serialize only the auto-save relevant data
    const currentDataString = JSON.stringify({
        title: data.title,
        content: data.content,
        tags: data.tags,
        customUrl: data.customUrl
    });

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
                // Update draftUrlRef if URL changed (e.g. custom_url was applied)
                if (response.data.status === 'DONE' && response.data.body.url) {
                    const newUrl = response.data.body.url;
                    if (newUrl !== draftUrlRef.current) {
                        draftUrlRef.current = newUrl;
                        currentOptions.onSuccess?.(newUrl);
                    }
                }
            } else {
                const response = await createDraft(payload);
                if (response.data.status === 'DONE') {
                    const url = response.data.body.url;
                    if (url) {
                        draftUrlRef.current = url;
                    }
                    currentOptions.onSuccess?.(url);
                }
            }

            setLastSaved(new Date());
            setHasSaveError(false);
            setHasPendingChanges(false);
            // Update previous data to prevent auto-save from triggering immediately
            prevDataStringRef.current = JSON.stringify({
                title: currentData.title,
                content: currentData.content,
                tags: currentData.tags,
                customUrl: currentData.customUrl
            });
            currentOptions.onSuccess?.();
            return true;
        } catch (error) {
            setHasSaveError(true);
            currentOptions.onError?.(error as Error);
            return false;
        } finally {
            setIsSaving(false);
        }
    }, [isSaving]);

    // Auto-save effect (JSON only, no image)
    useEffect(() => {
        if (!options.enabled) return;

        // Check if data has actually changed
        if (prevDataStringRef.current === currentDataString) return;

        // Skip initial load trigger - when data changes from empty to loaded
        if (isInitialLoadRef.current) {
            const prevData = JSON.parse(prevDataStringRef.current);
            const wasEmpty = !prevData.title && !prevData.content && !prevData.tags && !prevData.customUrl;

            if (wasEmpty) {
                isInitialLoadRef.current = false;
                prevDataStringRef.current = currentDataString;
                return;
            }
        }

        isInitialLoadRef.current = false;

        prevDataStringRef.current = currentDataString;
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
                // Auto-save uses JSON (no image), so temporarily clear image fields
                const savedImageFile = dataRef.current.imageFile;
                const savedImageDeleted = dataRef.current.imageDeleted;
                dataRef.current = {
                    ...dataRef.current,
                    imageFile: null,
                    imageDeleted: false
                };
                manualSave().finally(() => {
                    dataRef.current = {
                        ...dataRef.current,
                        imageFile: savedImageFile,
                        imageDeleted: savedImageDeleted
                    };
                });
            }
        }, intervalMs);

        return () => {
            if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
            if (countdownRef.current) clearInterval(countdownRef.current);
        };
    }, [currentDataString, options.enabled, intervalMs, manualSave]);

    return {
        lastSaved,
        isSaving,
        hasSaveError,
        hasPendingChanges,
        autoSaveCountdown,
        manualSave
    };
};
