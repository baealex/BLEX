import { useCallback, useEffect, useRef, useState } from 'react';
import { http } from '~/modules/http.module';

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
    const prevDataStringRef = useRef<string>(JSON.stringify({
        title: data.title,
        content: data.content,
        tags: data.tags
    }));

    // Keep refs updated
    dataRef.current = data;
    optionsRef.current = options;

    const { intervalMs = 10000 } = options;

    // Serialize only the auto-save relevant data
    const currentDataString = JSON.stringify({
        title: data.title,
        content: data.content,
        tags: data.tags
    });

    // Manual save
    const manualSave = useCallback(async () => {
        const currentData = dataRef.current;
        const currentOptions = optionsRef.current;

        if (isSaving || !currentOptions.enabled) return;

        setIsSaving(true);
        try {
            if (currentOptions.tempToken) {
                // Update temp post
                const formData = new URLSearchParams();
                formData.append('title', currentData.title || '제목 없음');
                formData.append('text_md', currentData.content);
                formData.append('tag', currentData.tags);

                await http(`v1/temp-posts/${currentOptions.tempToken}`, {
                    method: 'PUT',
                    data: formData,
                    headers: {
                        'X-CSRFToken': currentOptions.getCsrfToken(),
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                });
            } else {
                // Create temp post
                const response = await http('v1/temp-posts', {
                    method: 'POST',
                    data: {
                        title: currentData.title || '제목 없음',
                        content: currentData.content,
                        tags: currentData.tags
                    },
                    headers: {
                        'X-CSRFToken': currentOptions.getCsrfToken(),
                        'Content-Type': 'application/json'
                    }
                });
                currentOptions.onSuccess?.(response.data?.body?.token);
            }

            setLastSaved(new Date());
            currentOptions.onSuccess?.();
        } catch (error) {
            currentOptions.onError?.(error as Error);
        } finally {
            setIsSaving(false);
        }
    }, [isSaving]);

    // Auto-save effect
    useEffect(() => {
        if (!options.enabled) return;

        // Check if data has actually changed
        if (prevDataStringRef.current === currentDataString) return;

        // Update previous data
        prevDataStringRef.current = currentDataString;

        // Clear existing timers
        if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
        if (countdownRef.current) clearInterval(countdownRef.current);
        if (progressRef.current) clearInterval(progressRef.current);

        // Start countdown and progress
        setNextSaveIn(intervalMs);
        setSaveProgress(0);

        // Countdown timer
        countdownRef.current = window.setInterval(() => {
            setNextSaveIn(prev => Math.max(0, prev - 1000));
        }, 1000);

        // Progress bar
        progressRef.current = window.setInterval(() => {
            setSaveProgress(prev => Math.min(100, prev + (100 / (intervalMs / 100))));
        }, 100);

        // Auto save timer
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
