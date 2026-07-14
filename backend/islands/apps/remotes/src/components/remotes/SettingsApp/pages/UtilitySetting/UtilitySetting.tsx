import { useState } from 'react';
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
import { SettingsHeader } from '../../components';
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
            variant="secondary"
            size="md"
            className="h-11 w-full sm:w-auto"
            disabled={isPending}
            isLoading={isPreviewLoading}
            leftIcon={<Eye aria-hidden="true" className="h-4 w-4" />}
            onClick={onPreview}>
            1. {previewLabel}
        </Button>
        <Button
            variant={executeVariant}
            size="md"
            className="h-11 w-full sm:w-auto"
            disabled={!canExecute || isPending}
            isLoading={isExecuteLoading}
            leftIcon={<Trash2 aria-hidden="true" className="h-4 w-4" />}
            onClick={onExecute}>
            2. {executeLabel}
        </Button>
    </div>
);

const IMAGE_TARGET_ITEMS = [
    {
        value: 'all',
        label: '전체 이미지'
    },
    {
        value: 'content',
        label: '콘텐츠 이미지'
    },
    {
        value: 'title',
        label: '타이틀 이미지'
    },
    {
        value: 'avatar',
        label: '아바타 이미지'
    }
];

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

interface ResultPresentation {
    variant: 'info' | 'warning' | 'success' | 'error';
    title: string;
    message?: string;
}

const getSessionResultPresentation = (result: SessionCleanResult): ResultPresentation => {
    if (!result.dryRun) {
        return {
            variant: 'success',
            title: '세션 삭제 완료',
            message: `세션 ${result.cleanedCount}개를 삭제했습니다.`
        };
    }
    if (result.cleanAll) {
        return {
            variant: 'warning',
            title: '모든 세션 삭제 대상',
            message: `현재 관리자 세션을 포함한 ${result.totalSessions}개 세션이 모두 삭제됩니다.`
        };
    }
    return {
        variant: 'info',
        title: '만료 세션 삭제 대상',
        message: `만료된 세션 ${result.expiredSessions}개가 삭제되며 활성 세션은 유지됩니다.`
    };
};

const getImageResultPresentation = (result: ImageCleanResult): ResultPresentation => {
    if (result.dryRun) {
        return {
            variant: 'info',
            title: '삭제 대상 확인 결과'
        };
    }
    if (result.messages.some((message) => message.startsWith('오류:'))) {
        return {
            variant: 'error',
            title: '일부 이미지 처리 실패'
        };
    }
    return {
        variant: 'success',
        title: '이미지 삭제 완료'
    };
};

const formatImageResultMessage = (message: string, dryRun: boolean) => (
    dryRun ? message.replace(/ 정리$/, '가 삭제 대상입니다.') : message
);

const TagCleanupResult = ({ result }: { result: TagCleanResult }) => (
    <div aria-live="polite">
        <Alert
            variant={result.dryRun ? 'info' : 'success'}
            title={result.dryRun ? '삭제 대상 확인 결과' : '태그 삭제 완료'}>
            <p>
                {result.dryRun
                    ? `미사용 태그 ${result.unusedTags}개가 삭제 대상입니다.`
                    : `미사용 태그 ${result.cleanedCount}개를 삭제했습니다.`}
            </p>
            <p className="mt-1 text-xs">
                전체 {result.totalTags}개 · 사용 중 {result.usedTags}개
            </p>
        </Alert>
        {result.dryRun && result.cleanedTags.length > 0 && (
            <details className="mt-2 rounded-xl border border-line bg-surface-subtle/40">
                <summary className="flex min-h-11 cursor-pointer list-none items-center px-4 py-2 text-xs font-semibold text-content [&::-webkit-details-marker]:hidden">
                    미사용 태그 이름 {result.cleanedTags.length}개 보기
                </summary>
                <p className="border-t border-line px-4 py-3 text-xs leading-relaxed text-content-secondary">
                    {result.cleanedTags.join(', ')}
                </p>
            </details>
        )}
    </div>
);

const SessionCleanupResult = ({ result }: { result: SessionCleanResult }) => {
    const presentation = getSessionResultPresentation(result);

    return (
        <div aria-live="polite">
            <Alert variant={presentation.variant} title={presentation.title}>
                {presentation.message}
            </Alert>
        </div>
    );
};

const LogCleanupResult = ({ result }: { result: LogCleanResult }) => (
    <div aria-live="polite">
        <Alert
            variant={result.dryRun ? 'info' : 'success'}
            title={result.dryRun ? '삭제 대상 확인 결과' : '로그 삭제 완료'}>
            <p>
                관리자 활동 로그 {result.dryRun ? result.logCount : result.cleanedCount}개
            </p>
            <p className="mt-1">
                {result.developerApiLogRetentionDays}일이 지난 개발자 API 요청 로그 {result.dryRun
                    ? result.expiredDeveloperRequestLogCount
                    : result.cleanedDeveloperRequestLogCount}개
            </p>
        </Alert>
    </div>
);

const ImageCleanupResult = ({ result }: { result: ImageCleanResult }) => {
    const presentation = getImageResultPresentation(result);

    return (
        <div aria-live="polite">
            <Alert variant={presentation.variant} title={presentation.title}>
                <div className="space-y-1">
                    <p>미사용 파일: {result.totalUnused}개 ({result.totalSizeMb} MB)</p>
                    {result.totalDuplicates > 0 && (
                        <p>중복 파일: {result.totalDuplicates}개 ({result.totalDuplicateSizeMb} MB)</p>
                    )}
                    <p>절약 용량: {result.totalSavedMb} MB</p>
                    {result.messages.length > 0 && (
                        <ul className="mt-2 space-y-0.5 text-xs">
                            {result.messages.map((message, index) => (
                                <li key={`${message}-${index}`}>
                                    {formatImageResultMessage(message, result.dryRun)}
                                </li>
                            ))}
                        </ul>
                    )}
                    {result.dryRun && result.unusedFiles && result.unusedFiles.length > 0 && (
                        <details className="mt-3">
                            <summary className="flex min-h-11 cursor-pointer list-none items-center text-xs font-medium select-none [&::-webkit-details-marker]:hidden">
                                삭제 대상 이미지 ({result.unusedFiles.length}
                                {result.totalUnused > result.unusedFiles.length
                                    ? ` / ${result.totalUnused}`
                                    : ''}개)
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
                                중복 파일 ({result.duplicateFiles.length}개)
                            </summary>
                            <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
                                {result.duplicateFiles.map((duplicate) => (
                                    <div
                                        key={`${duplicate.hash}-${duplicate.duplicateUrl}`}
                                        className="flex items-center gap-3 rounded-lg bg-surface-subtle p-2">
                                        <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg border border-danger-line bg-surface-subtle">
                                            <img
                                                src={duplicate.duplicateUrl}
                                                alt="삭제 대상"
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
                                                alt="원본 유지"
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
    const { confirm } = useConfirm();
    const queryClient = useQueryClient();

    // Stats
    const { data: stats, isFetching: isStatsFetching } = useSuspenseQuery({
        queryKey: ['utility-stats'],
        queryFn: async () => {
            const { data } = await getUtilityStats();
            if (data.status === 'DONE') {
                return data.body;
            }
            throw new Error('통계를 불러오는데 실패했습니다.');
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
        mutationFn: (dryRun: boolean) => cleanTags(dryRun),
        onSuccess: ({ data }) => {
            if (data.status !== 'DONE') {
                toast.error('태그 정리에 실패했습니다.');
                return;
            }
            setTagResult(data.body);
            if (!data.body.dryRun) {
                toast.success(`미사용 태그 ${data.body.cleanedCount}개를 삭제했습니다.`);
                queryClient.invalidateQueries({ queryKey: ['utility-stats'] });
            }
        },
        onError: () => toast.error('태그 정리에 실패했습니다.')
    });

    const sessionMutation = useMutation({
        mutationFn: ({
            dryRun,
            cleanAll
        }: {
            dryRun: boolean;
            cleanAll: boolean;
        }) => cleanSessions(dryRun, cleanAll),
        onSuccess: ({ data }) => {
            if (data.status !== 'DONE') {
                toast.error('세션 정리에 실패했습니다.');
                return;
            }
            setSessionResult(data.body);
            if (!data.body.dryRun) {
                toast.success(`세션 ${data.body.cleanedCount}개를 삭제했습니다.`);
                queryClient.invalidateQueries({ queryKey: ['utility-stats'] });
            }
        },
        onError: () => toast.error('세션 정리에 실패했습니다.')
    });

    const logMutation = useMutation({
        mutationFn: (dryRun: boolean) => cleanLogs(dryRun),
        onSuccess: ({ data }) => {
            if (data.status !== 'DONE') {
                toast.error('로그 정리에 실패했습니다.');
                return;
            }
            setLogResult(data.body);
            if (!data.body.dryRun) {
                toast.success(
                    `관리자 로그 ${data.body.cleanedCount}개와 만료된 개발자 API 요청 로그 ${data.body.cleanedDeveloperRequestLogCount}개를 삭제했습니다.`
                );
                queryClient.invalidateQueries({ queryKey: ['utility-stats'] });
            }
        },
        onError: () => toast.error('로그 정리에 실패했습니다.')
    });

    const imageMutation = useMutation({
        mutationFn: ({
            dryRun,
            target,
            removeDups
        }: {
            dryRun: boolean;
            target: string;
            removeDups: boolean;
        }) => cleanImages(dryRun, target, removeDups),
        onSuccess: ({ data }) => {
            if (data.status !== 'DONE') {
                toast.error('이미지 정리에 실패했습니다.');
                return;
            }
            setImageResult(data.body);
            if (data.body.dryRun) {
                setHasPreviewed(true);
            } else {
                const hasErrors = data.body.messages.some((message) => message.startsWith('오류:'));
                if (hasErrors) {
                    toast.error('이미지 삭제는 완료됐지만 일부 파일을 처리하지 못했습니다.');
                } else {
                    toast.success(`이미지 ${data.body.totalUnused + data.body.totalDuplicates}개를 삭제했습니다. (${data.body.totalSavedMb} MB)`);
                }
                queryClient.invalidateQueries({ queryKey: ['utility-stats'] });
                setHasPreviewed(false);
            }
        },
        onError: () => toast.error('이미지 정리에 실패했습니다.')
    });

    const tagPreview = tagResult?.dryRun ? tagResult : null;
    const sessionPreview = sessionResult?.dryRun ? sessionResult : null;
    const logPreview = logResult?.dryRun ? logResult : null;
    const imagePreview = imageResult?.dryRun && hasPreviewed ? imageResult : null;
    const logPreviewDeleteCount = logPreview
        ? logPreview.logCount + logPreview.expiredDeveloperRequestLogCount
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
        if (!tagPreview) return;
        const confirmed = await confirm({
            title: '미사용 태그 삭제',
            message: `미리보기에서 확인한 미사용 태그 ${tagPreview.unusedTags}개를 영구 삭제합니다. 실행 시점의 상태에 따라 실제 수량은 달라질 수 있습니다.`,
            confirmText: `태그 ${tagPreview.unusedTags}개 삭제`,
            variant: 'danger'
        });
        if (confirmed) {
            tagMutation.mutate(false);
        }
    };

    const handleCleanExpiredSessions = async () => {
        if (!sessionPreview || sessionPreview.cleanAll) return;
        const confirmed = await confirm({
            title: '만료된 세션 삭제',
            message: `미리보기에서 확인한 만료 세션 ${sessionPreview.expiredSessions}개를 삭제합니다. 아직 유효한 사용자 세션은 유지됩니다.`,
            confirmText: `만료 세션 ${sessionPreview.expiredSessions}개 삭제`,
            variant: 'danger'
        });
        if (confirmed) {
            sessionMutation.mutate({
                dryRun: false,
                cleanAll: false
            });
        }
    };

    const handleCleanAllSessions = async () => {
        if (!sessionPreview?.cleanAll) return;
        const confirmed = await confirm({
            title: '모든 사용자 세션 삭제',
            message: `현재 관리자 세션을 포함한 모든 세션 ${sessionPreview.totalSessions}개를 삭제합니다. 실행 직후 모든 사용자가 로그아웃됩니다.`,
            confirmText: `모든 세션 ${sessionPreview.totalSessions}개 삭제`,
            variant: 'danger'
        });
        if (confirmed) {
            sessionMutation.mutate({
                dryRun: false,
                cleanAll: true
            });
        }
    };

    const handleCleanLogs = async () => {
        if (!logPreview) return;
        const confirmed = await confirm({
            title: '시스템 로그 삭제',
            message: `관리자 활동 로그 ${logPreview.logCount}개와 ${logPreview.developerApiLogRetentionDays}일이 지난 개발자 API 요청 로그 ${logPreview.expiredDeveloperRequestLogCount}개를 영구 삭제합니다.`,
            confirmText: `대상 로그 ${logPreviewDeleteCount}개 삭제`,
            variant: 'danger'
        });
        if (confirmed) {
            logMutation.mutate(false);
        }
    };

    const handleCleanImages = async () => {
        if (!imagePreview) return;
        const duplicateMessage = imagePreview.totalDuplicates > 0
            ? `, 중복 타이틀 이미지 ${imagePreview.totalDuplicates}개`
            : '';
        const confirmed = await confirm({
            title: '이미지 파일 삭제',
            message: `미사용 이미지 ${imagePreview.totalUnused}개${duplicateMessage}와 미리보기에서 확인한 관련 캐시를 영구 삭제합니다. 예상 정리 용량은 ${imagePreview.totalSavedMb} MB입니다.`,
            confirmText: '대상 이미지·캐시 삭제',
            variant: 'danger'
        });
        if (confirmed) {
            imageMutation.mutate({
                dryRun: false,
                target: imageTarget,
                removeDups: removeDuplicates
            });
        }
    };

    return (
        <div className="space-y-8">
            <SettingsHeader
                title="유틸리티"
                description="삭제 작업은 먼저 대상을 확인한 뒤 실행하세요."
                actionPosition="right"
                action={
                    <Button
                        variant="secondary"
                        size="md"
                        className="h-11 w-full sm:w-auto"
                        isLoading={isStatsFetching}
                        leftIcon={<RotateCw aria-hidden="true" className="h-4 w-4" />}
                        onClick={handleRefreshStats}>
                        통계 새로고침
                    </Button>
                }
            />

            {/* 데이터베이스 통계 */}
            <Card
                title="데이터베이스 통계"
                icon={<Database aria-hidden="true" className="h-4 w-4" />}>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                    <StatItem label="포스트" value={stats.totalPosts} />
                    <StatItem label="사용자" value={stats.totalUsers} />
                    <StatItem label="댓글" value={stats.totalComments} />
                    <StatItem label="시리즈" value={stats.totalSeries} />
                    <StatItem label="세션" value={stats.totalSessions} />
                    <StatItem label="DB 크기" value={stats.dbSize ?? 'N/A'} />
                </div>
            </Card>

            <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
                <div className="space-y-6">
                    {/* 태그 정리 */}
                    <Card
                        title="태그 정리"
                        subtitle="포스트에 사용되지 않는 태그를 찾아 삭제합니다."
                        icon={<Tags aria-hidden="true" className="h-4 w-4" />}>
                        <div className="space-y-4">
                            {tagResult && <TagCleanupResult result={tagResult} />}
                            <UtilityActionButtons
                                previewLabel="삭제 대상 확인"
                                executeLabel="미사용 태그 삭제"
                                canExecute={Boolean(tagPreview?.unusedTags)}
                                isPending={tagMutation.isPending}
                                isPreviewLoading={tagMutation.isPending && tagMutation.variables === true}
                                isExecuteLoading={tagMutation.isPending && tagMutation.variables === false}
                                onPreview={() => {
                                    setTagResult(null);
                                    tagMutation.mutate(true);
                                }}
                                onExecute={handleCleanTags}
                            />
                        </div>
                    </Card>

                    {/* 세션 정리 */}
                    <Card
                        title="세션 정리"
                        icon={<Clock aria-hidden="true" className="h-4 w-4" />}>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3 text-sm text-content-secondary">
                                <span className="rounded-lg bg-surface-subtle px-3 py-2">
                                    전체 <strong className="text-content">{stats.totalSessions}개</strong>
                                </span>
                                <span className="rounded-lg bg-surface-subtle px-3 py-2">
                                    만료 <strong className="text-content">{stats.expiredSessions}개</strong>
                                </span>
                            </div>
                            {sessionResult && <SessionCleanupResult result={sessionResult} />}

                            <div className="space-y-3 rounded-xl border border-line p-4">
                                <div>
                                    <h4 className="text-sm font-semibold text-content">만료된 세션</h4>
                                    <p className="mt-1 text-xs text-content-secondary">
                                        로그인 기한이 지난 세션만 삭제하고 활성 사용자는 유지합니다.
                                    </p>
                                </div>
                                <UtilityActionButtons
                                    previewLabel="만료 세션 확인"
                                    executeLabel="만료 세션 삭제"
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
                                    <h4 className="text-sm font-semibold text-danger">모든 사용자 세션</h4>
                                    <p className="mt-1 text-xs text-content-secondary">
                                        현재 관리자까지 포함해 모든 사용자를 즉시 로그아웃합니다.
                                    </p>
                                </div>
                                <UtilityActionButtons
                                    previewLabel="전체 세션 확인"
                                    executeLabel="모든 세션 삭제"
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
                        title="로그 정리"
                        subtitle="관리자 활동 로그 전체와 보존 기간이 지난 개발자 API 요청 로그를 삭제합니다."
                        icon={<ScrollText aria-hidden="true" className="h-4 w-4" />}>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3 text-sm text-content-secondary">
                                <span className="rounded-lg bg-surface-subtle px-3 py-2">
                                    관리자 로그 <strong className="text-content">{stats.logCount}개</strong>
                                </span>
                                <span className="rounded-lg bg-surface-subtle px-3 py-2">
                                    API 요청 로그 <strong className="text-content">{stats.developerRequestLogCount}개</strong>
                                </span>
                            </div>
                            {logResult && <LogCleanupResult result={logResult} />}
                            <UtilityActionButtons
                                previewLabel="삭제 대상 확인"
                                executeLabel="대상 로그 삭제"
                                canExecute={logPreviewDeleteCount > 0}
                                isPending={logMutation.isPending}
                                isPreviewLoading={logMutation.isPending && logMutation.variables === true}
                                isExecuteLoading={logMutation.isPending && logMutation.variables === false}
                                onPreview={() => {
                                    setLogResult(null);
                                    logMutation.mutate(true);
                                }}
                                onExecute={handleCleanLogs}
                            />
                        </div>
                    </Card>

                    {/* 이미지 정리 */}
                    <Card
                        title="이미지 정리"
                        subtitle="선택한 영역에서 사용되지 않는 이미지 파일을 찾아 삭제합니다."
                        icon={<Image aria-hidden="true" className="h-4 w-4" />}>
                        <div className="space-y-4">
                            <div className="flex flex-wrap items-start gap-4">
                                <div className="w-full min-w-[220px] flex-1">
                                    <label className="mb-1.5 block text-sm font-medium text-content">정리 대상</label>
                                    <Select
                                        value={imageTarget}
                                        onValueChange={(value) => {
                                            setImageTarget(value);
                                            setImageResult(null);
                                            setHasPreviewed(false);
                                        }}
                                        items={IMAGE_TARGET_ITEMS}
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
                                        label="중복 타이틀 이미지도 삭제"
                                        description="전체 또는 타이틀 이미지 대상에서 동일한 파일을 함께 삭제합니다."
                                    />
                                </div>
                            </div>
                            {imageResult && <ImageCleanupResult result={imageResult} />}
                            <UtilityActionButtons
                                previewLabel="삭제 대상 확인"
                                executeLabel="대상 이미지·캐시 삭제"
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
