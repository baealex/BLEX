import { useEffect, useState } from 'react';
import type { MouseEvent } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { Button } from '@blex/ui/button';
import { FloatingBottomBar } from '@blex/ui/floating-bottom-bar';
import { IconButton } from '@blex/ui/icon-button';
import {
    Eye,
    FileText,
    History,
    Loader2,
    Save,
    Send,
    SlidersHorizontal
} from '@blex/ui/icons';

interface PostActionsProps {
    mode: 'new' | 'edit' | 'draft';
    isSaving: boolean;
    isSubmitting: boolean;
    isMediaUploading?: boolean;
    isSubmitDisabled?: boolean;
    lastSaved: Date | null;
    hasSaveError?: boolean;
    hasPendingChanges?: boolean;
    autoSaveCountdown?: number | null;
    onManualSave: () => void;
    onSubmit: () => void;
    onOpenDrafts?: () => void;
    onPreview?: (event: MouseEvent<HTMLButtonElement>) => void;
    isPreviewing?: boolean;
    onOpenHistory?: (event: MouseEvent<HTMLButtonElement>) => void;
    onOpenSettings?: () => void;
    submitLabel?: string;
}

const PostActions = ({
    mode,
    isSaving,
    isSubmitting,
    isMediaUploading = false,
    isSubmitDisabled = false,
    lastSaved,
    hasSaveError = false,
    hasPendingChanges = false,
    autoSaveCountdown = null,
    onManualSave,
    onSubmit,
    onOpenDrafts,
    onPreview,
    isPreviewing = false,
    onOpenHistory,
    onOpenSettings,
    submitLabel
}: PostActionsProps) => {
    const { i18n, t } = useLingui();
    const isEdit = mode === 'edit';
    const actionLabel = submitLabel || (isEdit
        ? t({
            id: 'editor.actions.update',
            message: 'Update'
        })
        : t({
            id: 'editor.actions.publish',
            message: 'Publish'
        }));
    const isBusy = isSubmitting || isSaving || isMediaUploading;
    const [, setTick] = useState(0);
    const formatTimeSince = (date: Date): string => {
        const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
        if (seconds < 60) {
            return t({
                id: 'editor.autosave.saved_just_now',
                message: 'Saved just now'
            });
        }

        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) {
            return i18n._({
                id: 'editor.autosave.saved_minutes_ago',
                message: 'Saved {count, plural, one {# minute ago} other {# minutes ago}}',
                values: { count: minutes }
            });
        }

        const hours = Math.floor(minutes / 60);
        return i18n._({
            id: 'editor.autosave.saved_hours_ago',
            message: 'Saved {count, plural, one {# hour ago} other {# hours ago}}',
            values: { count: hours }
        });
    };

    // Update time display every 30 seconds
    useEffect(() => {
        if (!lastSaved) return;
        const timer = setInterval(() => setTick(t => t + 1), 30000);
        return () => clearInterval(timer);
    }, [lastSaved]);

    return (
        <FloatingBottomBar>
            {/* Temp Posts */}
            {!isEdit && onOpenDrafts && (
                <IconButton
                    onClick={onOpenDrafts}
                    rounded="full"
                    className="shrink-0"
                    aria-label={t({
                        id: 'editor.drafts.title',
                        message: 'Drafts'
                    })}
                    title={t({
                        id: 'editor.drafts.title',
                        message: 'Drafts'
                    })}>
                    <FileText className="w-5 h-5" />
                </IconButton>
            )}

            {/* Rendered Preview */}
            {onPreview && (
                <IconButton
                    onClick={onPreview}
                    disabled={isBusy || isPreviewing}
                    rounded="full"
                    className="shrink-0"
                    aria-label={t({
                        id: 'editor.preview.open',
                        message: 'Preview post'
                    })}
                    aria-busy={isPreviewing}
                    title={t({
                        id: 'editor.preview.open',
                        message: 'Preview post'
                    })}>
                    {isPreviewing ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                        <Eye className="h-5 w-5" />
                    )}
                </IconButton>
            )}

            {/* Revision History */}
            {onOpenHistory && (
                <IconButton
                    onClick={onOpenHistory}
                    disabled={isBusy}
                    rounded="full"
                    className="shrink-0"
                    aria-label={t({
                        id: 'editor.revisions.title',
                        message: 'Revision history'
                    })}
                    title={t({
                        id: 'editor.revisions.title',
                        message: 'Revision history'
                    })}>
                    <History className="h-5 w-5" />
                </IconButton>
            )}

            {/* Settings */}
            {onOpenSettings && (
                <IconButton
                    onClick={onOpenSettings}
                    rounded="full"
                    className="shrink-0"
                    aria-label={t({
                        id: 'editor.settings.title',
                        message: 'Post settings'
                    })}
                    title={t({
                        id: 'editor.settings.title',
                        message: 'Post settings'
                    })}
                    data-tour="post-settings">
                    <SlidersHorizontal className="w-5 h-5" />
                </IconButton>
            )}

            {/* Save Section */}
            {!isEdit && (
                <>
                    <div className="mx-1 h-8 w-px shrink-0 bg-line/50" />

                    {/* Autosave Status */}
                    <div
                        className="hidden shrink-0 items-center gap-1.5 px-1 text-xs text-content-hint sm:flex"
                        aria-live="polite"
                        data-tour="post-autosave">
                        {isSaving ? (
                            <>
                                <div className="w-1.5 h-1.5 rounded-full bg-line-strong animate-pulse" />
                                <span className="text-content-secondary">
                                    <Trans id="editor.autosave.saving">Saving...</Trans>
                                </span>
                            </>
                        ) : hasSaveError ? (
                            <>
                                <div className="w-1.5 h-1.5 rounded-full bg-danger" />
                                <span className="text-danger">
                                    <Trans id="editor.autosave.failed">Save failed</Trans>
                                </span>
                            </>
                        ) : autoSaveCountdown !== null ? (
                            <>
                                <div className="w-1.5 h-1.5 rounded-full bg-line-strong animate-pulse" />
                                <span className="text-content-secondary tabular-nums">
                                    {i18n._({
                                        id: 'editor.autosave.countdown',
                                        message: 'Save in {seconds, plural, one {# second} other {# seconds}}',
                                        values: { seconds: autoSaveCountdown }
                                    })}
                                </span>
                            </>
                        ) : hasPendingChanges ? (
                            <>
                                <div className="w-1.5 h-1.5 rounded-full bg-line-strong animate-pulse" />
                                <span className="text-content-secondary">
                                    <Trans id="editor.autosave.pending">Waiting to save</Trans>
                                </span>
                            </>
                        ) : lastSaved ? (
                            <>
                                <div className="w-1.5 h-1.5 rounded-full bg-action-hover" />
                                <span>{formatTimeSince(lastSaved)}</span>
                            </>
                        ) : (
                            <>
                                <div className="w-1.5 h-1.5 rounded-full bg-line-strong" />
                                <span><Trans id="editor.autosave.enabled">Autosave on</Trans></span>
                            </>
                        )}
                    </div>

                    {/* Manual Save Button */}
                    <IconButton
                        size="sm"
                        rounded="full"
                        onClick={onManualSave}
                        disabled={isBusy}
                        className="shrink-0 sm:hidden"
                        aria-label={t({
                            id: 'editor.actions.save_draft',
                            message: 'Save draft'
                        })}
                        title={t({
                            id: 'editor.actions.save_draft',
                            message: 'Save draft'
                        })}>
                        <Save className="h-4 w-4" />
                    </IconButton>
                    <button
                        type="button"
                        onClick={onManualSave}
                        disabled={isBusy}
                        className="hidden shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-content-secondary transition-all hover:bg-surface-subtle hover:text-content active:scale-95 disabled:opacity-50 sm:flex motion-interaction"
                        title={t({
                            id: 'editor.actions.save_draft',
                            message: 'Save draft'
                        })}>
                        <span><Trans id="editor.actions.save_draft">Save draft</Trans></span>
                    </button>
                </>
            )}

            {/* Publish/Update Button */}
            <Button
                onClick={onSubmit}
                disabled={isBusy || isSubmitDisabled}
                variant="primary"
                className="min-h-11! shrink-0 !rounded-full"
                leftIcon={<Send className="w-4 h-4" />}
                data-tour="post-publish">
                {actionLabel}
            </Button>
        </FloatingBottomBar>
    );
};

export default PostActions;
