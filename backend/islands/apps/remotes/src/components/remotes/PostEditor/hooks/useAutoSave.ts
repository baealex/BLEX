import { useEffect, useRef, useState } from 'react';
import { createTempPost, updateTempPost } from '~/lib/api/posts';

interface AutoSaveData {
    title: string;
    content: string;
    tags: string;
}

interface UseAutoSaveOptions {
    enabled: boolean;
    intervalMs?: number;
    getCsrfToken: () => string;
    tempToken?: string;
    onSuccess?: (token?: string) => void;
    onError?: (error: Error) => void;
}

export const useAutoSave = (data: AutoSaveData, options: UseAutoSaveOptions) => {
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [nextSaveIn, setNextSaveIn] = useState<number>(0);
    const [saveProgress, setSaveProgress] = useState<number>(0);

    const autoSaveRef = useRef<number | null>(null);
    const countdownRef = useRef<number | null>(null);
    const progressRef = useRef<number | null>(null);
    const dataRef = useRef(data);
    const optionsRef = useRef(options);
    const tempTokenRef = useRef<string | undefined>(options.tempToken);
    const prevDataStringRef = useRef<string>(JSON.stringify({
        title: data.title,
        content: data.content,
        tags: data.tags
    }));
    const isInitialLoadRef = useRef(true);

    dataRef.current = data;
    optionsRef.current = options;

    const { intervalMs = 3000 } = options;

    // Serialize only the auto-save relevant data
    const currentDataString = JSON.stringify({
        title: data.title,
        content: data.content,
        tags: data.tags
    });

    // Manual save
    const manualSave = async () => {
        const currentData = dataRef.current;
        const currentOptions = optionsRef.current;

        if (isSaving || !currentOptions.enabled) return;

        // Clear existing timers when manually saving
        if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
        if (countdownRef.current) clearInterval(countdownRef.current);
        if (progressRef.current) clearInterval(progressRef.current);

        setIsSaving(true);
        try {
            if (tempTokenRef.current) {
                await updateTempPost(tempTokenRef.current, {
                    title: currentData.title || '제목 없음',
                    text_md: currentData.content,
                    tag: currentData.tags
                });
            } else {
                const response = await createTempPost({
                    title: currentData.title || '제목 없음',
                    content: currentData.content,
                    tags: currentData.tags
                });
                if (response.data.status === 'DONE') {
                    const token = response.data.body.token;
                    if (token) {
                        tempTokenRef.current = token;
                    }
                    currentOptions.onSuccess?.(token);
                }
            }

            setLastSaved(new Date());
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
        } catch (error) {
            currentOptions.onError?.(error as Error);
        } finally {
            setIsSaving(false);
        }
    };

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
        nextSaveIn,
        saveProgress,
        manualSave
    };
};
