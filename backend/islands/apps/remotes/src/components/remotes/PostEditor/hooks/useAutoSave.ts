import { useCallback, useEffect, useRef, useState } from 'react';
import { createDraft, updateDraft } from '~/lib/api/posts';

interface AutoSaveData {
    title: string;
    content: string;
    tags: string;
    subtitle?: string;
    description?: string;
    seriesUrl?: string;
}

interface UseAutoSaveOptions {
    enabled: boolean;
    intervalMs?: number;
    draftUrl?: string;
    onSuccess?: (url?: string) => void;
    onError?: (error: Error) => void;
}

export const useAutoSave = (data: AutoSaveData, options: UseAutoSaveOptions) => {
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [hasSaveError, setHasSaveError] = useState(false);
    const [nextSaveIn, setNextSaveIn] = useState<number>(0);
    const [saveProgress, setSaveProgress] = useState<number>(0);

    const autoSaveRef = useRef<number | null>(null);
    const countdownRef = useRef<number | null>(null);
    const progressRef = useRef<number | null>(null);
    const dataRef = useRef(data);
    const optionsRef = useRef(options);
    const draftUrlRef = useRef<string | undefined>(options.draftUrl);
    const prevDataStringRef = useRef<string>(JSON.stringify({
        title: data.title,
        content: data.content,
        tags: data.tags
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
        tags: data.tags
    });

    // Manual save - returns true on success, false on failure
    const manualSave = useCallback(async (): Promise<boolean> => {
        const currentData = dataRef.current;
        const currentOptions = optionsRef.current;

        if (isSaving || !currentOptions.enabled) return false;

        // Clear existing timers when manually saving
        if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
        if (countdownRef.current) clearInterval(countdownRef.current);
        if (progressRef.current) clearInterval(progressRef.current);

        setIsSaving(true);
        try {
            if (draftUrlRef.current) {
                await updateDraft(draftUrlRef.current, {
                    title: currentData.title || '제목 없음',
                    content: currentData.content,
                    tags: currentData.tags,
                    subtitle: currentData.subtitle,
                    description: currentData.description,
                    series_url: currentData.seriesUrl
                });
            } else {
                const response = await createDraft({
                    title: currentData.title || '제목 없음',
                    content: currentData.content,
                    tags: currentData.tags,
                    subtitle: currentData.subtitle,
                    description: currentData.description,
                    series_url: currentData.seriesUrl
                });
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
            // Reset progress after manual save
            setNextSaveIn(0);
            setSaveProgress(0);
            // Update previous data to prevent auto-save from triggering immediately
            prevDataStringRef.current = JSON.stringify({
                title: currentData.title,
                content: currentData.content,
                tags: currentData.tags
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

    // Auto-save effect
    useEffect(() => {
        if (!options.enabled) return;

        // Check if data has actually changed
        if (prevDataStringRef.current === currentDataString) return;

        // Skip initial load trigger - when data changes from empty to loaded
        if (isInitialLoadRef.current) {
            const prevData = JSON.parse(prevDataStringRef.current);
            const wasEmpty = !prevData.title && !prevData.content && !prevData.tags;

            if (wasEmpty) {
                isInitialLoadRef.current = false;
                prevDataStringRef.current = currentDataString;
                return;
            }
        }

        isInitialLoadRef.current = false;

        prevDataStringRef.current = currentDataString;

        if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
        if (countdownRef.current) clearInterval(countdownRef.current);
        if (progressRef.current) clearInterval(progressRef.current);

        setNextSaveIn(intervalMs);
        setSaveProgress(0);

        countdownRef.current = window.setInterval(() => {
            setNextSaveIn(prev => Math.max(0, prev - 1000));
        }, 1000);

        progressRef.current = window.setInterval(() => {
            setSaveProgress(prev => Math.min(100, prev + (100 / (intervalMs / 100))));
        }, 100);

        autoSaveRef.current = window.setTimeout(() => {
            const currentData = dataRef.current;
            if (currentData.title || currentData.content) {
                manualSave();
            }
        }, intervalMs);

        return () => {
            if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
            if (countdownRef.current) clearInterval(countdownRef.current);
            if (progressRef.current) clearInterval(progressRef.current);
        };
    }, [currentDataString, options.enabled, intervalMs, manualSave]);

    return {
        lastSaved,
        isSaving,
        hasSaveError,
        nextSaveIn,
        saveProgress,
        manualSave
    };
};
