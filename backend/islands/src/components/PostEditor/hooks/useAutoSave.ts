import { useCallback, useEffect, useRef, useState } from 'react';
import { http } from '~/modules/http.module';

interface AutoSaveData {
    title: string;
    content: string;
    tags: string[];
    metaDescription: string;
    url: string;
    seriesId: string;
    hide: boolean;
    notice: boolean;
    advertise: boolean;
}

interface UseAutoSaveOptions {
    enabled: boolean;
    intervalMs?: number;
    getCsrfToken: () => string;
    onSuccess?: (token?: string) => void;
    onError?: (error: any) => void;
}

export const useAutoSave = (data: AutoSaveData, options: UseAutoSaveOptions) => {
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const autoSaveRef = useRef<number>();
    const {
        enabled,
        intervalMs = 30000,
        getCsrfToken,
        onSuccess,
        onError
    } = options;

    const performAutoSave = useCallback(async () => {
        if (isSaving || !enabled) return;

        setIsSaving(true);
        try {
            const tempData = {
                title: data.title || '제목 없음',
                content: data.content,
                tags: data.tags,
                meta_description: data.metaDescription,
                url: data.url,
                series: data.seriesId || '',
                hide: data.hide,
                notice: data.notice,
                advertise: data.advertise
            };

            const response = await http('v1/temp-posts', {
                method: 'POST',
                data: tempData,
                headers: {
                    'X-CSRFToken': getCsrfToken(),
                    'Content-Type': 'application/json'
                }
            });

            if (response.data?.status === 'DONE') {
                setLastSaved(new Date());
                onSuccess?.(response.data.body?.token);
            }
        } catch (error) {
            onError?.(error);
        } finally {
            setIsSaving(false);
        }
    }, [data, enabled, isSaving, getCsrfToken, onSuccess, onError]);

    const manualSave = useCallback(async () => {
        await performAutoSave();
    }, [performAutoSave]);

    // Auto-save effect
    useEffect(() => {
        if (!enabled) return;

        if (autoSaveRef.current) {
            clearTimeout(autoSaveRef.current);
        }

        autoSaveRef.current = window.setTimeout(() => {
            if (data.title || data.content) {
                performAutoSave();
            }
        }, intervalMs);

        return () => {
            if (autoSaveRef.current) {
                clearTimeout(autoSaveRef.current);
            }
        };
    }, [enabled, data.title, data.content, data.tags, data.seriesId, data.metaDescription, data.url, data.hide, data.notice, data.advertise, intervalMs, performAutoSave]);

    return {
        lastSaved,
        isSaving,
        manualSave
    };
};