import { useState } from 'react';
import { useLingui } from '@lingui/react/macro';
import { toast } from '~/utils/toast';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import {
    ArrowRight,
    Clock,
    Database,
    Eye,
    FileImage,
    Image,
    RotateCw,
    ScrollText,
    Tags,
    Trash2
} from '@blex/ui/icons';
import { useConfirm } from '~/hooks/useConfirm';
import { SettingsHeader, SettingsHeaderAction } from '../../components';
import {
    Alert, Button, Card, Checkbox, Select
} from '~/components/shared';
import {
    getUtilityStats,
    cleanTags,
    cleanSessions,
    cleanLogs,
    cleanImages,
    type TagCleanResult,
    type SessionCleanResult,
    type LogCleanResult,
    type ImageCleanResult
} from '~/lib/api/settings';

interface ImageThumbnailProps {
    src: string;
    alt: string;
}

interface UtilityActionButtonsProps {
    previewLabel: string;
    executeLabel: string;
    canExecute: boolean;
    isPending: boolean;
    isPreviewLoading: boolean;
    isExecuteLoading: boolean;
    executeVariant?: 'danger' | 'danger-solid';
    onPreview: () => void;
    onExecute: () => void;
}

const UtilityActionButtons = ({
    previewLabel,
    executeLabel,
    canExecute,
    isPending,
    isPreviewLoading,
    isExecuteLoading,
    executeVariant = 'danger',
    onPreview,
    onExecute
}: UtilityActionButtonsProps) => (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button
            density="compact"
            variant="secondary"
            size="md"
            className="h-11 w-full [@media(pointer:fine)]:h-10 sm:w-auto"
            disabled={isPending}
            isLoading={isPreviewLoading}
            leftIcon={<Eye aria-hidden="true" className="h-4 w-4" />}
            onClick={onPreview}>
            1. {previewLabel}
        </Button>
        <Button
            density="compact"
            variant={executeVariant}
            size="md"
            className="h-11 w-full [@media(pointer:fine)]:h-10 sm:w-auto"
            disabled={!canExecute || isPending}
            isLoading={isExecuteLoading}
            leftIcon={<Trash2 aria-hidden="true" className="h-4 w-4" />}
            onClick={onExecute}>
            2. {executeLabel}
        </Button>
    </div>
);

const ImageThumbnail = ({ src, alt }: ImageThumbnailProps) => {
    const [hasError, setHasError] = useState(false);

    return (
        <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-line bg-surface-subtle">
            {hasError ? (
                <FileImage aria-hidden="true" className="h-5 w-5 text-content-hint" />
            ) : (
                <img
                    src={src}
                    alt={alt}
                    loading="lazy"
                    className="h-full w-full object-cover"
                    onError={() => setHasError(true)}
                />
            )}
        </div>
    );
};

const TagCleanupResult = ({ result }: { result: TagCleanResult }) => {
    const { i18n, t } = useLingui();

    return (
        <div aria-live="polite">
            <Alert
                variant={result.dryRun ? 'info' : 'success'}
                title={result.dryRun
                    ? t({
                        id: 'settings.utility.result.preview_title',
                        message: 'Cleanup preview'
                    })
                    : t({
                        id: 'settings.utility.tags.result.success_title',
                        message: 'Tags deleted'
                    })}>
                <p>
                    {result.dryRun
                        ? i18n._({
                            id: 'settings.utility.tags.result.preview',
                            message: '{count, plural, one {# unused tag is ready for deletion.} other {# unused tags are ready for deletion.}}',
                            values: { count: result.unusedTags }
                        })
                        : i18n._({
                            id: 'settings.utility.tags.result.success',
                            message: '{count, plural, one {Deleted # unused tag.} other {Deleted # unused tags.}}',
                            values: { count: result.cleanedCount }
                        })}
                </p>
                <p className="mt-1 text-xs">
                    {i18n._({
                        id: 'settings.utility.tags.result.stats',
                        message: '{total} total · {used} in use',
                        values: {
                            total: result.totalTags,
                            used: result.usedTags
                        }
                    })}
                </p>
            </Alert>
            {result.dryRun && result.cleanedTags.length > 0 && (
                <details className="mt-2 rounded-xl border border-line bg-surface-subtle/40">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center px-4 py-2 text-xs font-semibold text-content [&::-webkit-details-marker]:hidden">
                        {i18n._({
                            id: 'settings.utility.tags.result.show_names',
                            message: '{count, plural, one {Show # unused tag name} other {Show # unused tag names}}',
                            values: { count: result.cleanedTags.length }
                        })}
                    </summary>
                    <p className="border-t border-line px-4 py-3 text-xs leading-relaxed text-content-secondary">
                        {result.cleanedTags.join(', ')}
                    </p>
                </details>
            )}
        </div>
    );
};

const SessionCleanupResult = ({ result }: { result: SessionCleanResult }) => {
    const { i18n, t } = useLingui();
    const presentation = !result.dryRun
        ? {
            variant: 'success' as const,
            title: t({
                id: 'settings.utility.sessions.result.success_title',
                message: 'Sessions deleted'
            }),
            message: i18n._({
                id: 'settings.utility.sessions.result.success',
                message: '{count, plural, one {Deleted # session.} other {Deleted # sessions.}}',
                values: { count: result.cleanedCount }
            })
        }
        : result.cleanAll
            ? {
                variant: 'warning' as const,
                title: t({
                    id: 'settings.utility.sessions.result.all_preview_title',
                    message: 'All sessions ready for deletion'
                }),
                message: i18n._({
                    id: 'settings.utility.sessions.result.all_preview',
                    message: '{count, plural, one {# session, including the current administrator session, will be deleted.} other {All # sessions, including the current administrator session, will be deleted.}}',
                    values: { count: result.totalSessions }
                })
            }
            : {
                variant: 'info' as const,
                title: t({
                    id: 'settings.utility.sessions.result.expired_preview_title',
                    message: 'Expired sessions ready for deletion'
                }),
                message: i18n._({
                    id: 'settings.utility.sessions.result.expired_preview',
                    message: '{count, plural, one {# expired session will be deleted. Active sessions will be kept.} other {# expired sessions will be deleted. Active sessions will be kept.}}',
                    values: { count: result.expiredSessions }
                })
            };

    return (
        <div aria-live="polite">
            <Alert variant={presentation.variant} title={presentation.title}>
                {presentation.message}
            </Alert>
        </div>
    );
};

const LogCleanupResult = ({ result }: { result: LogCleanResult }) => {
    const { i18n, t } = useLingui();

    return (
        <div aria-live="polite">
            <Alert
                variant={result.dryRun ? 'info' : 'success'}
                title={result.dryRun
                    ? t({
                        id: 'settings.utility.result.preview_title',
                        message: 'Cleanup preview'
                    })
                    : t({
                        id: 'settings.utility.logs.result.success_title',
                        message: 'Logs deleted'
                    })}>
                <p>
                    {i18n._({
                        id: 'settings.utility.logs.result.admin',
                        message: 'Admin activity logs older than {days} days: {count}',
                        values: {
                            days: result.adminAuditLogRetentionDays,
                            count: result.dryRun ? result.expiredLogCount : result.cleanedCount
                        }
                    })}
                </p>
                <p className="mt-1">
                    {i18n._({
                        id: 'settings.utility.logs.result.developer',
                        message: 'Developer API request logs older than {days} days: {count}',
                        values: {
                            days: result.developerApiLogRetentionDays,
                            count: result.dryRun
                                ? result.expiredDeveloperRequestLogCount
                                : result.cleanedDeveloperRequestLogCount
                        }
                    })}
                </p>
            </Alert>
        </div>
    );
};

const ImageCleanupResult = ({ result }: { result: ImageCleanResult }) => {
    const { i18n, t } = useLingui();
    const presentation = result.dryRun
        ? {
            variant: 'info' as const,
            title: t({
                id: 'settings.utility.result.preview_title',
                message: 'Cleanup preview'
            })
        }
        : result.hasErrors
            ? {
                variant: 'error' as const,
                title: t({
                    id: 'settings.utility.images.result.partial_failure_title',
                    message: 'Some images could not be processed'
                })
            }
            : {
                variant: 'success' as const,
                title: t({
                    id: 'settings.utility.images.result.success_title',
                    message: 'Images deleted'
                })
            };

    return (
        <div aria-live="polite">
            <Alert variant={presentation.variant} title={presentation.title}>
                <div className="space-y-1">
                    <p>
                        {i18n._({
                            id: 'settings.utility.images.result.unused',
                            message: 'Unused files: {count} ({size} MB)',
                            values: {
                                count: result.totalUnused,
                                size: result.totalSizeMb
                            }
                        })}
                    </p>
                    {result.totalDuplicates > 0 && (
                        <p>
                            {i18n._({
                                id: 'settings.utility.images.result.duplicates',
                                message: 'Duplicate files: {count} ({size} MB)',
                                values: {
                                    count: result.totalDuplicates,
                                    size: result.totalDuplicateSizeMb
                                }
                            })}
                        </p>
                    )}
                    <p>
                        {i18n._({
                            id: 'settings.utility.images.result.saved_space',
                            message: 'Space reclaimed: {size} MB',
                            values: { size: result.totalSavedMb }
                        })}
                    </p>
                    {result.messages.length > 0 && (
                        <ul className="mt-2 space-y-0.5 text-xs">
                            {result.messages.map((message, index) => (
                                <li key={`${message}-${index}`}>{message}</li>
                            ))}
                        </ul>
                    )}
                    {result.dryRun && result.unusedFiles && result.unusedFiles.length > 0 && (
                        <details className="mt-3">
                            <summary className="flex min-h-11 cursor-pointer list-none items-center text-xs font-medium select-none [&::-webkit-details-marker]:hidden">
                                {result.totalUnused > result.unusedFiles.length
                                    ? i18n._({
                                        id: 'settings.utility.images.result.unused_files_partial',
                                        message: 'Images ready for deletion ({shown} of {total})',
                                        values: {
                                            shown: result.unusedFiles.length,
                                            total: result.totalUnused
                                        }
                                    })
                                    : i18n._({
                                        id: 'settings.utility.images.result.unused_files',
                                        message: 'Images ready for deletion ({count})',
                                        values: { count: result.unusedFiles.length }
                                    })}
                            </summary>
                            <div className="mt-3 grid max-h-80 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4 md:grid-cols-5">
                                {result.unusedFiles.map((file) => (
                                    <div key={file.path} className="group relative">
                                        <ImageThumbnail src={file.url} alt={file.path} />
                                        <div className="mt-1 truncate text-[10px] text-content-secondary" title={file.path}>
                                            {file.sizeKb} KB
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </details>
                    )}
                    {result.dryRun && result.duplicateFiles && result.duplicateFiles.length > 0 && (
                        <details className="mt-3">
                            <summary className="flex min-h-11 cursor-pointer list-none items-center text-xs font-medium select-none [&::-webkit-details-marker]:hidden">
                                {i18n._({
                                    id: 'settings.utility.images.result.duplicate_files',
                                    message: 'Duplicate files ({count})',
                                    values: { count: result.duplicateFiles.length }
                                })}
                            </summary>
                            <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
                                {result.duplicateFiles.map((duplicate) => (
                                    <div
                                        key={`${duplicate.hash}-${duplicate.duplicateUrl}`}
                                        className="flex items-center gap-3 rounded-lg bg-surface-subtle p-2">
                                        <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg border border-danger-line bg-surface-subtle">
                                            <img
                                                src={duplicate.duplicateUrl}
                                                alt={t({
                                                    id: 'settings.utility.images.result.duplicate_alt',
                                                    message: 'Ready for deletion'
                                                })}
                                                loading="lazy"
                                                className="h-full w-full object-cover"
                                            />
                                        </div>
                                        <div className="flex-shrink-0 text-content-hint">
                                            <ArrowRight aria-hidden="true" className="h-4 w-4" />
                                        </div>
                                        <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg border border-line bg-surface-subtle">
                                            <img
                                                src={duplicate.originalUrl}
                                                alt={t({
                                                    id: 'settings.utility.images.result.original_alt',
                                                    message: 'Original to keep'
                                                })}
                                                loading="lazy"
                                                className="h-full w-full object-cover"
                                            />
                                        </div>
                                        <div className="text-[10px] text-content-secondary">
                                            <span className="text-danger">{duplicate.duplicateSizeKb} KB</span>
                                            {' → '}
                                            <span className="text-content">{duplicate.originalSizeKb} KB</span>
                                            <span className="ml-1 text-content-hint">({duplicate.hash})</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </details>
                    )}
                </div>
            </Alert>
        </div>
    );
};

const UtilitySetting = () => {
    const { i18n, t } = useLingui();
    const { confirm } = useConfirm();
    const queryClient = useQueryClient();
    const imageTargetItems = [
        {
            value: 'all',
            label: t({
                id: 'settings.utility.images.target.all',
                message: 'All images'
            })
        },
        {
            value: 'content',
            label: t({
                id: 'settings.utility.images.target.content',
                message: 'Content images'
            })
        },
        {
            value: 'title',
            label: t({
                id: 'settings.utility.images.target.title',
                message: 'Title images'
            })
        },
        {
            value: 'avatar',
            label: t({
                id: 'settings.utility.images.target.avatar',
                message: 'Avatar images'
            })
        }
    ];

    // Stats
    const { data: stats, isFetching: isStatsFetching } = useSuspenseQuery({
        queryKey: ['utility-stats'],
        queryFn: async () => {
            const { data } = await getUtilityStats();
            if (data.status === 'DONE') {
                return data.body;
            }
            throw new Error(t({
                id: 'settings.utility.stats.load_error',
                message: 'Failed to load utility statistics.'
            }));
        }
    });

    // Tag state
    const [tagResult, setTagResult] = useState<TagCleanResult | null>(null);

    // Session state
    const [sessionResult, setSessionResult] = useState<SessionCleanResult | null>(null);

    // Log state
    const [logResult, setLogResult] = useState<LogCleanResult | null>(null);

    // Image state
    const [imageTarget, setImageTarget] = useState('all');
    const [removeDuplicates, setRemoveDuplicates] = useState(false);
    const [imageResult, setImageResult] = useState<ImageCleanResult | null>(null);
    const [hasPreviewed, setHasPreviewed] = useState(false);

    // Mutations
    const tagMutation = useMutation({
        mutationFn: ({
            dryRun,
            confirmationToken
        }: {
            dryRun: boolean;
            confirmationToken?: string;
        }) => cleanTags(dryRun, confirmationToken),
        onSuccess: ({ data }, variables) => {
            if (data.status !== 'DONE') {
                if (!variables.dryRun) setTagResult(null);
                toast.error(data.errorMessage || t({
                    id: 'settings.utility.tags.error',
                    message: 'Failed to clean up tags.'
                }));
                return;
            }
            setTagResult(data.body);
            if (!data.body.dryRun) {
                toast.success(i18n._({
                    id: 'settings.utility.tags.result.success',
                    message: '{count, plural, one {Deleted # unused tag.} other {Deleted # unused tags.}}',
                    values: { count: data.body.cleanedCount }
                }));
                queryClient.invalidateQueries({ queryKey: ['utility-stats'] });
            }
        },
        onError: () => toast.error(t({
            id: 'settings.utility.tags.error',
            message: 'Failed to clean up tags.'
        }))
    });

    const sessionMutation = useMutation({
        mutationFn: ({
            dryRun,
            cleanAll,
            confirmationToken
        }: {
            dryRun: boolean;
            cleanAll: boolean;
            confirmationToken?: string;
        }) => cleanSessions(dryRun, cleanAll, confirmationToken),
        onSuccess: ({ data }, variables) => {
            if (data.status !== 'DONE') {
                if (!variables.dryRun) setSessionResult(null);
                toast.error(data.errorMessage || t({
                    id: 'settings.utility.sessions.error',
                    message: 'Failed to clean up sessions.'
                }));
                return;
            }
            setSessionResult(data.body);
            if (!data.body.dryRun) {
                toast.success(i18n._({
                    id: 'settings.utility.sessions.result.success',
                    message: '{count, plural, one {Deleted # session.} other {Deleted # sessions.}}',
                    values: { count: data.body.cleanedCount }
                }));
                queryClient.invalidateQueries({ queryKey: ['utility-stats'] });
            }
        },
        onError: () => toast.error(t({
            id: 'settings.utility.sessions.error',
            message: 'Failed to clean up sessions.'
        }))
    });

    const logMutation = useMutation({
        mutationFn: ({
            dryRun,
            confirmationToken
        }: {
            dryRun: boolean;
            confirmationToken?: string;
        }) => cleanLogs(dryRun, confirmationToken),
        onSuccess: ({ data }, variables) => {
            if (data.status !== 'DONE') {
                if (!variables.dryRun) setLogResult(null);
                toast.error(data.errorMessage || t({
                    id: 'settings.utility.logs.error',
                    message: 'Failed to clean up logs.'
                }));
                return;
            }
            setLogResult(data.body);
            if (!data.body.dryRun) {
                toast.success(i18n._({
                    id: 'settings.utility.logs.success',
                    message: 'Deleted {adminCount} expired admin activity logs and {developerCount} expired developer API request logs.',
                    values: {
                        adminCount: data.body.cleanedCount,
                        developerCount: data.body.cleanedDeveloperRequestLogCount
                    }
                }));
                queryClient.invalidateQueries({ queryKey: ['utility-stats'] });
            }
        },
        onError: () => toast.error(t({
            id: 'settings.utility.logs.error',
            message: 'Failed to clean up logs.'
        }))
    });

    const imageMutation = useMutation({
        mutationFn: ({
            dryRun,
            target,
            removeDups,
            confirmationToken
        }: {
            dryRun: boolean;
            target: string;
            removeDups: boolean;
            confirmationToken?: string;
        }) => cleanImages(dryRun, target, removeDups, confirmationToken),
        onSuccess: ({ data }, variables) => {
            if (data.status !== 'DONE') {
                if (!variables.dryRun) {
                    setImageResult(null);
                    setHasPreviewed(false);
                }
                toast.error(data.errorMessage || t({
                    id: 'settings.utility.images.error',
                    message: 'Failed to clean up images.'
                }));
                return;
            }
            setImageResult(data.body);
            if (data.body.dryRun) {
                setHasPreviewed(true);
            } else {
                if (data.body.hasErrors) {
                    toast.error(t({
                        id: 'settings.utility.images.partial_failure',
                        message: 'Image deletion finished, but some files could not be processed.'
                    }));
                } else {
                    toast.success(i18n._({
                        id: 'settings.utility.images.success',
                        message: 'Deleted {count} images and reclaimed {size} MB.',
                        values: {
                            count: data.body.totalUnused + data.body.totalDuplicates,
                            size: data.body.totalSavedMb
                        }
                    }));
                }
                queryClient.invalidateQueries({ queryKey: ['utility-stats'] });
                setHasPreviewed(false);
            }
        },
        onError: () => toast.error(t({
            id: 'settings.utility.images.error',
            message: 'Failed to clean up images.'
        }))
    });

    const tagPreview = tagResult?.dryRun && tagResult.confirmationToken ? tagResult : null;
    const sessionPreview = sessionResult?.dryRun && sessionResult.confirmationToken ? sessionResult : null;
    const logPreview = logResult?.dryRun && logResult.confirmationToken ? logResult : null;
    const imagePreview = imageResult?.dryRun && imageResult.confirmationToken && hasPreviewed ? imageResult : null;
    const logPreviewDeleteCount = logPreview
        ? logPreview.expiredLogCount + logPreview.expiredDeveloperRequestLogCount
        : 0;

    const handleRefreshStats = () => {
        setTagResult(null);
        setSessionResult(null);
        setLogResult(null);
        setImageResult(null);
        setHasPreviewed(false);
        void queryClient.invalidateQueries({ queryKey: ['utility-stats'] });
    };

    const handleCleanTags = async () => {
        if (!tagPreview?.confirmationToken) return;
        const confirmed = await confirm({
            title: t({
                id: 'settings.utility.tags.confirm.title',
                message: 'Delete unused tags'
            }),
            message: i18n._({
                id: 'settings.utility.tags.confirm.message',
                message: 'Permanently delete {count, plural, one {# unused tag} other {# unused tags}} confirmed in the preview. The final count may change before execution.',
                values: { count: tagPreview.unusedTags }
            }),
            confirmText: i18n._({
                id: 'settings.utility.tags.confirm.action',
                message: 'Delete {count, plural, one {# tag} other {# tags}}',
                values: { count: tagPreview.unusedTags }
            }),
            variant: 'danger'
        });
        if (confirmed) {
            tagMutation.mutate({
                dryRun: false,
                confirmationToken: tagPreview.confirmationToken
            });
        }
    };

    const handleCleanExpiredSessions = async () => {
        if (!sessionPreview?.confirmationToken || sessionPreview.cleanAll) return;
        const confirmed = await confirm({
            title: t({
                id: 'settings.utility.sessions.expired.confirm.title',
                message: 'Delete expired sessions'
            }),
            message: i18n._({
                id: 'settings.utility.sessions.expired.confirm.message',
                message: 'Delete {count, plural, one {# expired session} other {# expired sessions}} confirmed in the preview. Active user sessions will be kept.',
                values: { count: sessionPreview.expiredSessions }
            }),
            confirmText: i18n._({
                id: 'settings.utility.sessions.expired.confirm.action',
                message: 'Delete {count, plural, one {# expired session} other {# expired sessions}}',
                values: { count: sessionPreview.expiredSessions }
            }),
            variant: 'danger'
        });
        if (confirmed) {
            sessionMutation.mutate({
                dryRun: false,
                cleanAll: false,
                confirmationToken: sessionPreview.confirmationToken
            });
        }
    };

    const handleCleanAllSessions = async () => {
        if (!sessionPreview?.cleanAll || !sessionPreview.confirmationToken) return;
        const confirmed = await confirm({
            title: t({
                id: 'settings.utility.sessions.all.confirm.title',
                message: 'Delete all user sessions'
            }),
            message: i18n._({
                id: 'settings.utility.sessions.all.confirm.message',
                message: 'Delete all {count} sessions, including the current administrator session. Every user will be logged out immediately.',
                values: { count: sessionPreview.totalSessions }
            }),
            confirmText: i18n._({
                id: 'settings.utility.sessions.all.confirm.action',
                message: 'Delete all {count} sessions',
                values: { count: sessionPreview.totalSessions }
            }),
            variant: 'danger'
        });
        if (confirmed) {
            sessionMutation.mutate({
                dryRun: false,
                cleanAll: true,
                confirmationToken: sessionPreview.confirmationToken
            });
        }
    };

    const handleCleanLogs = async () => {
        if (!logPreview?.confirmationToken) return;
        const confirmed = await confirm({
            title: t({
                id: 'settings.utility.logs.confirm.title',
                message: 'Delete system logs'
            }),
            message: i18n._({
                id: 'settings.utility.logs.confirm.message',
                message: 'Permanently delete {adminCount} admin activity logs older than {adminDays} days and {developerCount} developer API request logs older than {developerDays} days.',
                values: {
                    adminCount: logPreview.expiredLogCount,
                    adminDays: logPreview.adminAuditLogRetentionDays,
                    developerCount: logPreview.expiredDeveloperRequestLogCount,
                    developerDays: logPreview.developerApiLogRetentionDays
                }
            }),
            confirmText: i18n._({
                id: 'settings.utility.logs.confirm.action',
                message: 'Delete {count, plural, one {# log} other {# logs}}',
                values: { count: logPreviewDeleteCount }
            }),
            variant: 'danger'
        });
        if (confirmed) {
            logMutation.mutate({
                dryRun: false,
                confirmationToken: logPreview.confirmationToken
            });
        }
    };

    const handleCleanImages = async () => {
        if (!imagePreview?.confirmationToken) return;
        const confirmed = await confirm({
            title: t({
                id: 'settings.utility.images.confirm.title',
                message: 'Delete image files'
            }),
            message: imagePreview.totalDuplicates > 0
                ? i18n._({
                    id: 'settings.utility.images.confirm.message_with_duplicates',
                    message: 'Permanently delete {unusedCount} unused images, {duplicateCount} duplicate title images, and the related caches confirmed in the preview. Estimated space reclaimed: {size} MB.',
                    values: {
                        unusedCount: imagePreview.totalUnused,
                        duplicateCount: imagePreview.totalDuplicates,
                        size: imagePreview.totalSavedMb
                    }
                })
                : i18n._({
                    id: 'settings.utility.images.confirm.message',
                    message: 'Permanently delete {count} unused images and the related caches confirmed in the preview. Estimated space reclaimed: {size} MB.',
                    values: {
                        count: imagePreview.totalUnused,
                        size: imagePreview.totalSavedMb
                    }
                }),
            confirmText: t({
                id: 'settings.utility.images.confirm.action',
                message: 'Delete selected images and caches'
            }),
            variant: 'danger'
        });
        if (confirmed) {
            imageMutation.mutate({
                dryRun: false,
                target: imageTarget,
                removeDups: removeDuplicates,
                confirmationToken: imagePreview.confirmationToken
            });
        }
    };

    return (
        <div className="space-y-8">
            <SettingsHeader
                title={t({
                    id: 'settings.utility.title',
                    message: 'Utilities'
                })}
                description={t({
                    id: 'settings.utility.description',
                    message: 'Run a cleanup within five minutes of reviewing its preview.'
                })}
                actionPosition="right"
                action={
                    <SettingsHeaderAction
                        variant="secondary"
                        isLoading={isStatsFetching}
                        leftIcon={<RotateCw aria-hidden="true" className="h-4 w-4" />}
                        onClick={handleRefreshStats}>
                        {t({
                            id: 'settings.utility.stats.refresh',
                            message: 'Refresh statistics'
                        })}
                    </SettingsHeaderAction>
                }
            />

            {/* 데이터베이스 통계 */}
            <Card
                title={t({
                    id: 'settings.utility.stats.title',
                    message: 'Database statistics'
                })}
                icon={<Database aria-hidden="true" className="h-4 w-4" />}>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                    <StatItem
                        label={t({
                            id: 'settings.utility.stats.posts',
                            message: 'Posts'
                        })}
                        value={stats.totalPosts}
                    />
                    <StatItem
                        label={t({
                            id: 'settings.utility.stats.users',
                            message: 'Users'
                        })}
                        value={stats.totalUsers}
                    />
                    <StatItem
                        label={t({
                            id: 'settings.utility.stats.comments',
                            message: 'Comments'
                        })}
                        value={stats.totalComments}
                    />
                    <StatItem
                        label={t({
                            id: 'settings.utility.stats.series',
                            message: 'Series'
                        })}
                        value={stats.totalSeries}
                    />
                    <StatItem
                        label={t({
                            id: 'settings.utility.stats.sessions',
                            message: 'Sessions'
                        })}
                        value={stats.totalSessions}
                    />
                    <StatItem
                        label={t({
                            id: 'settings.utility.stats.db_size',
                            message: 'Database size'
                        })}
                        value={stats.dbSize ?? 'N/A'}
                    />
                </div>
            </Card>

            <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
                <div className="space-y-6">
                    {/* 태그 정리 */}
                    <Card
                        title={t({
                            id: 'settings.utility.tags.title',
                            message: 'Tag cleanup'
                        })}
                        subtitle={t({
                            id: 'settings.utility.tags.description',
                            message: 'Find and delete tags that are not used by any post.'
                        })}
                        icon={<Tags aria-hidden="true" className="h-4 w-4" />}>
                        <div className="space-y-4">
                            {tagResult && <TagCleanupResult result={tagResult} />}
                            <UtilityActionButtons
                                previewLabel={t({
                                    id: 'settings.utility.action.preview',
                                    message: 'Review cleanup'
                                })}
                                executeLabel={t({
                                    id: 'settings.utility.tags.action.delete',
                                    message: 'Delete unused tags'
                                })}
                                canExecute={Boolean(tagPreview?.unusedTags)}
                                isPending={tagMutation.isPending}
                                isPreviewLoading={Boolean(
                                    tagMutation.isPending
                                    && tagMutation.variables?.dryRun
                                )}
                                isExecuteLoading={Boolean(
                                    tagMutation.isPending
                                    && tagMutation.variables?.dryRun === false
                                )}
                                onPreview={() => {
                                    setTagResult(null);
                                    tagMutation.mutate({ dryRun: true });
                                }}
                                onExecute={handleCleanTags}
                            />
                        </div>
                    </Card>

                    {/* 세션 정리 */}
                    <Card
                        title={t({
                            id: 'settings.utility.sessions.title',
                            message: 'Session cleanup'
                        })}
                        icon={<Clock aria-hidden="true" className="h-4 w-4" />}>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3 text-sm text-content-secondary">
                                <span className="rounded-lg bg-surface-subtle px-3 py-2">
                                    {i18n._({
                                        id: 'settings.utility.sessions.stats.total',
                                        message: 'Total: {count}',
                                        values: { count: stats.totalSessions }
                                    })}
                                </span>
                                <span className="rounded-lg bg-surface-subtle px-3 py-2">
                                    {i18n._({
                                        id: 'settings.utility.sessions.stats.expired',
                                        message: 'Expired: {count}',
                                        values: { count: stats.expiredSessions }
                                    })}
                                </span>
                            </div>
                            {sessionResult && <SessionCleanupResult result={sessionResult} />}

                            <div className="space-y-3 rounded-xl border border-line p-4">
                                <div>
                                    <h4 className="text-sm font-semibold text-content">
                                        {t({
                                            id: 'settings.utility.sessions.expired.title',
                                            message: 'Expired sessions'
                                        })}
                                    </h4>
                                    <p className="mt-1 text-xs text-content-secondary">
                                        {t({
                                            id: 'settings.utility.sessions.expired.description',
                                            message: 'Delete only expired login sessions and keep active users signed in.'
                                        })}
                                    </p>
                                </div>
                                <UtilityActionButtons
                                    previewLabel={t({
                                        id: 'settings.utility.sessions.expired.action.preview',
                                        message: 'Review expired sessions'
                                    })}
                                    executeLabel={t({
                                        id: 'settings.utility.sessions.expired.action.delete',
                                        message: 'Delete expired sessions'
                                    })}
                                    canExecute={Boolean(sessionPreview && !sessionPreview.cleanAll && sessionPreview.expiredSessions > 0)}
                                    isPending={sessionMutation.isPending}
                                    isPreviewLoading={Boolean(
                                        sessionMutation.isPending
                                        && sessionMutation.variables?.dryRun
                                        && !sessionMutation.variables.cleanAll
                                    )}
                                    isExecuteLoading={Boolean(
                                        sessionMutation.isPending
                                        && sessionMutation.variables?.dryRun === false
                                        && !sessionMutation.variables.cleanAll
                                    )}
                                    onPreview={() => {
                                        setSessionResult(null);
                                        sessionMutation.mutate({
                                            dryRun: true,
                                            cleanAll: false
                                        });
                                    }}
                                    onExecute={handleCleanExpiredSessions}
                                />
                            </div>

                            <div className="space-y-3 rounded-xl border border-danger-line bg-danger-surface/40 p-4">
                                <div>
                                    <h4 className="text-sm font-semibold text-danger">
                                        {t({
                                            id: 'settings.utility.sessions.all.title',
                                            message: 'All user sessions'
                                        })}
                                    </h4>
                                    <p className="mt-1 text-xs text-content-secondary">
                                        {t({
                                            id: 'settings.utility.sessions.all.description',
                                            message: 'Immediately log out every user, including the current administrator.'
                                        })}
                                    </p>
                                </div>
                                <UtilityActionButtons
                                    previewLabel={t({
                                        id: 'settings.utility.sessions.all.action.preview',
                                        message: 'Review all sessions'
                                    })}
                                    executeLabel={t({
                                        id: 'settings.utility.sessions.all.action.delete',
                                        message: 'Delete all sessions'
                                    })}
                                    executeVariant="danger-solid"
                                    canExecute={Boolean(sessionPreview?.cleanAll && sessionPreview.totalSessions > 0)}
                                    isPending={sessionMutation.isPending}
                                    isPreviewLoading={Boolean(
                                        sessionMutation.isPending
                                        && sessionMutation.variables?.dryRun
                                        && sessionMutation.variables.cleanAll
                                    )}
                                    isExecuteLoading={Boolean(
                                        sessionMutation.isPending
                                        && sessionMutation.variables?.dryRun === false
                                        && sessionMutation.variables.cleanAll
                                    )}
                                    onPreview={() => {
                                        setSessionResult(null);
                                        sessionMutation.mutate({
                                            dryRun: true,
                                            cleanAll: true
                                        });
                                    }}
                                    onExecute={handleCleanAllSessions}
                                />
                            </div>
                        </div>
                    </Card>
                </div>

                <div className="space-y-6">
                    {/* 로그 정리 */}
                    <Card
                        title={t({
                            id: 'settings.utility.logs.title',
                            message: 'Log cleanup'
                        })}
                        subtitle={t({
                            id: 'settings.utility.logs.description',
                            message: 'Delete only admin activity and developer API request logs beyond their retention periods.'
                        })}
                        icon={<ScrollText aria-hidden="true" className="h-4 w-4" />}>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3 text-sm text-content-secondary">
                                <span className="rounded-lg bg-surface-subtle px-3 py-2">
                                    {i18n._({
                                        id: 'settings.utility.logs.stats.admin',
                                        message: 'Admin logs: {count}',
                                        values: { count: stats.logCount }
                                    })}
                                </span>
                                <span className="rounded-lg bg-surface-subtle px-3 py-2">
                                    {i18n._({
                                        id: 'settings.utility.logs.stats.developer',
                                        message: 'API request logs: {count}',
                                        values: { count: stats.developerRequestLogCount }
                                    })}
                                </span>
                            </div>
                            {logResult && <LogCleanupResult result={logResult} />}
                            <UtilityActionButtons
                                previewLabel={t({
                                    id: 'settings.utility.action.preview',
                                    message: 'Review cleanup'
                                })}
                                executeLabel={t({
                                    id: 'settings.utility.logs.action.delete',
                                    message: 'Delete selected logs'
                                })}
                                canExecute={logPreviewDeleteCount > 0}
                                isPending={logMutation.isPending}
                                isPreviewLoading={Boolean(
                                    logMutation.isPending
                                    && logMutation.variables?.dryRun
                                )}
                                isExecuteLoading={Boolean(
                                    logMutation.isPending
                                    && logMutation.variables?.dryRun === false
                                )}
                                onPreview={() => {
                                    setLogResult(null);
                                    logMutation.mutate({ dryRun: true });
                                }}
                                onExecute={handleCleanLogs}
                            />
                        </div>
                    </Card>

                    {/* 이미지 정리 */}
                    <Card
                        title={t({
                            id: 'settings.utility.images.title',
                            message: 'Image cleanup'
                        })}
                        subtitle={t({
                            id: 'settings.utility.images.description',
                            message: 'Find and delete unused image files in the selected area.'
                        })}
                        icon={<Image aria-hidden="true" className="h-4 w-4" />}>
                        <div className="space-y-4">
                            <div className="flex flex-wrap items-start gap-4">
                                <div className="w-full min-w-[220px] flex-1">
                                    <label className="mb-1.5 block text-sm font-medium text-content">
                                        {t({
                                            id: 'settings.utility.images.target.label',
                                            message: 'Cleanup target'
                                        })}
                                    </label>
                                    <Select
                                        density="compact"
                                        value={imageTarget}
                                        onValueChange={(value) => {
                                            setImageTarget(value);
                                            setImageResult(null);
                                            setHasPreviewed(false);
                                        }}
                                        items={imageTargetItems}
                                    />
                                </div>
                                <div className="w-full min-w-[220px] flex-1 pt-1">
                                    <Checkbox
                                        checked={removeDuplicates}
                                        className="min-h-11 py-2"
                                        onCheckedChange={(checked) => {
                                            setRemoveDuplicates(checked);
                                            setImageResult(null);
                                            setHasPreviewed(false);
                                        }}
                                        label={t({
                                            id: 'settings.utility.images.duplicates.label',
                                            message: 'Also delete duplicate title images'
                                        })}
                                        description={t({
                                            id: 'settings.utility.images.duplicates.description',
                                            message: 'When cleaning all images or title images, also delete identical files.'
                                        })}
                                    />
                                </div>
                            </div>
                            {imageResult && <ImageCleanupResult result={imageResult} />}
                            <UtilityActionButtons
                                previewLabel={t({
                                    id: 'settings.utility.action.preview',
                                    message: 'Review cleanup'
                                })}
                                executeLabel={t({
                                    id: 'settings.utility.images.action.delete',
                                    message: 'Delete selected images and caches'
                                })}
                                canExecute={Boolean(imagePreview)}
                                isPending={imageMutation.isPending}
                                isPreviewLoading={imageMutation.isPending && imageMutation.variables?.dryRun === true}
                                isExecuteLoading={imageMutation.isPending && imageMutation.variables?.dryRun === false}
                                onPreview={() => {
                                    setImageResult(null);
                                    setHasPreviewed(false);
                                    imageMutation.mutate({
                                        dryRun: true,
                                        target: imageTarget,
                                        removeDups: removeDuplicates
                                    });
                                }}
                                onExecute={handleCleanImages}
                            />
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};

const StatItem = ({
    label,
    value
}: {
    label: string;
    value: string | number;
}) => (
    <div className="bg-surface-subtle rounded-xl p-4">
        <div className="text-xs text-content-secondary mb-1">{label}</div>
        <div className="text-lg font-semibold text-content">{typeof value === 'number' ? value.toLocaleString() : value}</div>
    </div>
);

export default UtilitySetting;
