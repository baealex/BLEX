import { useCallback, useEffect, useRef, useState } from 'react';
import { useLingui } from '@lingui/react/macro';
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
    hide: boolean;
    advertise: boolean;
    blockComment: boolean;
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

const buildDraftPayload = (
    data: AutoSaveData,
    useFormData: boolean,
    untitledLabel: string
) => {
    if (useFormData) {
        const formData = new FormData();
        formData.append('title', data.title || untitledLabel);
        formData.append('content', data.content);
        formData.append('tags', data.tags);
        if (data.subtitle) formData.append('subtitle', data.subtitle);
        if (data.description) formData.append('description', data.description);
        if (data.seriesUrl !== undefined) formData.append('seriesUrl', data.seriesUrl);
        if (data.customUrl) formData.append('customUrl', data.customUrl);
        if (data.coverLayout) formData.append('coverLayout', data.coverLayout);
        if (data.coverImagePosition) formData.append('coverImagePosition', data.coverImagePosition);
        if (data.coverImageRatio) formData.append('coverImageRatio', data.coverImageRatio);
        formData.append('isHide', String(data.hide));
        formData.append('isAdvertise', String(data.advertise));
        formData.append('blockComment', String(data.blockComment));
        if (data.reservedDate !== undefined) formData.append('reservedDate', data.reservedDate);
        if (data.imageFile) formData.append('image', data.imageFile);
        if (data.imageDeleted) formData.append('imageDelete', 'true');
        return formData;
    }

    return {
        title: data.title || untitledLabel,
        content: data.content,
        tags: data.tags,
        subtitle: data.subtitle,
        description: data.description,
        seriesUrl: data.seriesUrl,
        customUrl: data.customUrl,
        coverLayout: data.coverLayout,
        coverImagePosition: data.coverImagePosition,
        coverImageRatio: data.coverImageRatio,
        isHide: data.hide,
        isAdvertise: data.advertise,
        blockComment: data.blockComment,
        reservedDate: data.reservedDate
    };
};

const ensureDraftSaved = (
    response: Response<{ url: string }>,
    fallbackErrorMessage: string
) => {
    if (response.status === 'DONE') {
        return response.body;
    }

    throw new Error(response.errorMessage || fallbackErrorMessage);
};

export const useAutoSave = (data: AutoSaveData, options: UseAutoSaveOptions) => {
    const { t } = useLingui();
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
    const pausedRef = useRef(false);
    const activeSavesRef = useRef(new Set<Promise<string | null>>());
    // A timer cancelled by a pause or a finishing save still owes the author a save.
    const hasUnsavedEditsRef = useRef(false);
    const [resumeCount, setResumeCount] = useState(0);
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
        hide: value.hide,
        advertise: value.advertise,
        blockComment: value.blockComment,
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

    const runSave = useCallback(async (): Promise<string | null> => {
        const currentData = dataRef.current;
        const currentOptions = optionsRef.current;

        if (isSaving || !currentOptions.enabled || pausedRef.current) return null;

        hasUnsavedEditsRef.current = false;

        // Clear existing timer and countdown when manually saving
        if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
        if (countdownRef.current) clearInterval(countdownRef.current);
        setAutoSaveCountdown(null);

        const needsFormData = !!currentData.imageFile || !!currentData.imageDeleted;

        setIsSaving(true);
        try {
            const untitledLabel = t({
                id: 'editor.common.untitled',
                message: 'Untitled'
            });
            const fallbackErrorMessage = t({
                id: 'editor.autosave.error',
                message: 'Could not save the draft.'
            });
            const payload = buildDraftPayload(
                currentData,
                needsFormData,
                untitledLabel
            );

            if (draftUrlRef.current) {
                const response = await updateDraft(draftUrlRef.current, payload);
                const body = ensureDraftSaved(response.data, fallbackErrorMessage);
                // Update draftUrlRef if URL changed (e.g. customUrl was applied)
                if (body.url) {
                    const newUrl = body.url;
                    if (newUrl !== draftUrlRef.current) {
                        draftUrlRef.current = newUrl;
                        currentOptions.onSuccess?.(newUrl);
                    }
                }
            } else {
                const response = await createDraft(payload);
                const body = ensureDraftSaved(response.data, fallbackErrorMessage);
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
            return draftUrlRef.current || null;
        } catch (error) {
            setHasSaveError(true);
            currentOptions.onError?.(error as Error);
            return null;
        } finally {
            setIsSaving(false);
        }
    }, [isSaving, getDataSignature, getContentSignature, t]);

    // Manual save - returns the persisted draft URL on success
    const manualSave = useCallback(() => {
        const save = runSave();
        activeSavesRef.current.add(save);
        void save.finally(() => activeSavesRef.current.delete(save));
        return save;
    }, [runSave]);

    /** Stops new saves and waits for running ones, so publishing cannot race a draft write. */
    const pauseAutoSave = useCallback(async () => {
        pausedRef.current = true;
        if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
        if (countdownRef.current) clearInterval(countdownRef.current);
        setAutoSaveCountdown(null);
        await Promise.all(activeSavesRef.current);
        return draftUrlRef.current;
    }, []);

    const resumeAutoSave = useCallback(() => {
        pausedRef.current = false;
        setResumeCount(count => count + 1);
    }, []);

    // Auto-save effect
    useEffect(() => {
        if (!options.enabled || pausedRef.current) return;

        // Capture the hydrated editor state once autosave becomes available.
        // This separates initial draft loading from the user's first change.
        if (isInitialLoadRef.current) {
            isInitialLoadRef.current = false;
            prevDataStringRef.current = currentDataString;
            prevContentStringRef.current = currentContentString;
            return;
        }

        // Check if data has actually changed
        const hasNewChanges = prevDataStringRef.current !== currentDataString;
        if (!hasNewChanges && !hasUnsavedEditsRef.current) return;

        if (hasNewChanges && skipNextImageResetRef.current && prevContentStringRef.current === currentContentString) {
            skipNextImageResetRef.current = false;
            prevDataStringRef.current = currentDataString;
            return;
        }

        skipNextImageResetRef.current = false;

        prevDataStringRef.current = currentDataString;
        prevContentStringRef.current = currentContentString;
        hasUnsavedEditsRef.current = true;
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
            } else {
                hasUnsavedEditsRef.current = false;
            }
        }, intervalMs);

        return () => {
            if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
            if (countdownRef.current) clearInterval(countdownRef.current);
        };
    }, [currentDataString, currentContentString, options.enabled, intervalMs, manualSave, resumeCount]);

    return {
        lastSaved,
        isSaving,
        hasSaveError,
        hasPendingChanges,
        autoSaveCountdown,
        manualSave,
        pauseAutoSave,
        resumeAutoSave
    };
};
