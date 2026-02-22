import { useState } from 'react';
import { toast } from '~/utils/toast';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
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

const UtilitySetting = () => {
    const { confirm } = useConfirm();
    const queryClient = useQueryClient();

    // Stats
    const { data: stats } = useSuspenseQuery({
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
            if (data.status === 'DONE') {
                setTagResult(data.body);
                if (!data.body.dryRun) {
                    toast.success(`미사용 태그 ${data.body.cleanedCount}개를 삭제했습니다.`);
                    queryClient.invalidateQueries({ queryKey: ['utility-stats'] });
                }
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
            if (data.status === 'DONE') {
                setSessionResult(data.body);
                if (!data.body.dryRun) {
                    toast.success(`세션 ${data.body.cleanedCount}개를 삭제했습니다.`);
                    queryClient.invalidateQueries({ queryKey: ['utility-stats'] });
                }
            }
        },
        onError: () => toast.error('세션 정리에 실패했습니다.')
    });

    const logMutation = useMutation({
        mutationFn: (dryRun: boolean) => cleanLogs(dryRun),
        onSuccess: ({ data }) => {
            if (data.status === 'DONE') {
                setLogResult(data.body);
                if (!data.body.dryRun) {
                    toast.success(`로그 ${data.body.cleanedCount}개를 삭제했습니다.`);
                    queryClient.invalidateQueries({ queryKey: ['utility-stats'] });
                }
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
            if (data.status === 'DONE') {
                setImageResult(data.body);
                if (data.body.dryRun) {
                    setHasPreviewed(true);
                } else {
                    toast.success(`이미지 정리가 완료되었습니다. (${data.body.totalSavedMb} MB 절약)`);
                    queryClient.invalidateQueries({ queryKey: ['utility-stats'] });
                    setHasPreviewed(false);
                }
            }
        },
        onError: () => toast.error('이미지 정리에 실패했습니다.')
    });

    const handleCleanTags = async () => {
        const confirmed = await confirm({
            title: '태그 정리',
            message: `미사용 태그 ${tagResult?.unusedTags ?? stats.totalSessions}개를 삭제하시겠습니까?`,
            confirmText: '삭제'
        });
        if (confirmed) {
            tagMutation.mutate(false);
        }
    };

    const handleCleanExpiredSessions = async () => {
        const confirmed = await confirm({
            title: '만료된 세션 정리',
            message: `만료된 세션 ${sessionResult?.expiredSessions ?? stats.expiredSessions}개를 삭제하시겠습니까?`,
            confirmText: '삭제'
        });
        if (confirmed) {
            sessionMutation.mutate({
                dryRun: false,
                cleanAll: false
            });
        }
    };

    const handleCleanAllSessions = async () => {
        const confirmed = await confirm({
            title: '모든 세션 정리',
            message: '모든 세션을 삭제하면 모든 사용자가 로그아웃됩니다. 계속하시겠습니까?',
            confirmText: '모두 삭제'
        });
        if (confirmed) {
            sessionMutation.mutate({
                dryRun: false,
                cleanAll: true
            });
        }
    };

    const handleCleanLogs = async () => {
        const confirmed = await confirm({
            title: '로그 정리',
            message: `관리자 로그 ${logResult?.logCount ?? stats.logCount}개를 삭제하시겠습니까?`,
            confirmText: '삭제'
        });
        if (confirmed) {
            logMutation.mutate(false);
        }
    };

    const handleCleanImages = async () => {
        const confirmed = await confirm({
            title: '이미지 정리',
            message: `미사용 이미지를 삭제하시겠습니까? (${imageResult?.totalSavedMb ?? 0} MB 절약 예상)`,
            confirmText: '삭제'
        });
        if (confirmed) {
            imageMutation.mutate({
                dryRun: false,
                target: imageTarget,
                removeDups: removeDuplicates
            });
        }
    };

    const targetItems = [
        {
            value: 'all',
            label: '전체'
        },
        {
            value: 'content',
            label: '컨텐츠 이미지'
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

    return (
        <div className="space-y-8">
            <SettingsHeader
                title="유틸리티"
                description="데이터베이스 통계 확인 및 시스템 정리 도구입니다."
                action={
                    <Button
                        variant="secondary"
                        size="md"
                        compact
                        leftIcon={<i className="fas fa-sync-alt" />}
                        onClick={() => queryClient.invalidateQueries({ queryKey: ['utility-stats'] })}>
                        새로고침
                    </Button>
                }
            />

            {/* 데이터베이스 통계 */}
            <Card
                title="데이터베이스 통계"
                subtitle="현재 데이터베이스의 주요 통계입니다."
                icon={<i className="fas fa-database" />}>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <StatItem label="포스트" value={stats.totalPosts} />
                    <StatItem label="사용자" value={stats.totalUsers} />
                    <StatItem label="댓글" value={stats.totalComments} />
                    <StatItem label="시리즈" value={stats.totalSeries} />
                    <StatItem label="세션" value={stats.totalSessions} />
                    <StatItem label="DB 크기" value={stats.dbSize ?? 'N/A'} />
                </div>
            </Card>

            {/* 태그 정리 */}
            <Card
                title="태그 정리"
                subtitle="포스트에 사용되지 않는 태그를 찾아 삭제합니다."
                icon={<i className="fas fa-tags" />}>
                <div className="space-y-4">
                    {tagResult && (
                        <Alert variant={tagResult.dryRun ? 'info' : 'success'}>
                            <p>전체: {tagResult.totalTags}개 / 사용 중: {tagResult.usedTags}개 / 미사용: {tagResult.unusedTags}개</p>
                            {tagResult.cleanedCount > 0 && !tagResult.dryRun && (
                                <p className="mt-1">{tagResult.cleanedCount}개 태그 삭제 완료</p>
                            )}
                            {tagResult.dryRun && tagResult.cleanedTags.length > 0 && (
                                <p className="mt-1 text-xs">미사용: {tagResult.cleanedTags.join(', ')}</p>
                            )}
                        </Alert>
                    )}
                    <div className="flex gap-2">
                        <Button
                            variant="secondary"
                            size="sm"
                            compact
                            isLoading={tagMutation.isPending && tagMutation.variables === true}
                            onClick={() => tagMutation.mutate(true)}>
                            미리보기
                        </Button>
                        <Button
                            variant="primary"
                            size="sm"
                            compact
                            isLoading={tagMutation.isPending && tagMutation.variables === false}
                            onClick={handleCleanTags}>
                            정리하기
                        </Button>
                    </div>
                </div>
            </Card>

            {/* 세션 정리 */}
            <Card
                title="세션 정리"
                subtitle="만료되었거나 불필요한 세션을 정리합니다."
                icon={<i className="fas fa-clock" />}>
                <div className="space-y-4">
                    <div className="flex gap-6 text-sm text-gray-600">
                        <span>전체 세션: <strong className="text-gray-900">{stats.totalSessions}</strong></span>
                        <span>만료된 세션: <strong className="text-gray-900">{stats.expiredSessions}</strong></span>
                    </div>
                    {sessionResult && (
                        <Alert variant={sessionResult.dryRun ? 'info' : 'success'}>
                            {sessionResult.dryRun
                                ? `삭제 예정: ${sessionResult.cleanAll ? sessionResult.totalSessions : sessionResult.expiredSessions}개`
                                : `${sessionResult.cleanedCount}개 세션 삭제 완료`
                            }
                        </Alert>
                    )}
                    <div className="flex gap-2">
                        <Button
                            variant="secondary"
                            size="sm"
                            compact
                            isLoading={sessionMutation.isPending && !sessionMutation.variables?.cleanAll}
                            onClick={handleCleanExpiredSessions}>
                            만료된 세션 정리
                        </Button>
                        <Button
                            variant="danger"
                            size="sm"
                            compact
                            isLoading={sessionMutation.isPending && !!sessionMutation.variables?.cleanAll}
                            onClick={handleCleanAllSessions}>
                            모든 세션 정리
                        </Button>
                    </div>
                </div>
            </Card>

            {/* 로그 정리 */}
            <Card
                title="로그 정리"
                subtitle="관리자 활동 로그를 정리합니다."
                icon={<i className="fas fa-scroll" />}>
                <div className="space-y-4">
                    <div className="text-sm text-gray-600">
                        로그 수: <strong className="text-gray-900">{stats.logCount}</strong>
                    </div>
                    {logResult && (
                        <Alert variant={logResult.dryRun ? 'info' : 'success'}>
                            {logResult.dryRun
                                ? `삭제 예정: ${logResult.logCount}개의 로그`
                                : `${logResult.cleanedCount}개 로그 삭제 완료`
                            }
                        </Alert>
                    )}
                    <Button
                        variant="primary"
                        size="sm"
                        compact
                        isLoading={logMutation.isPending}
                        onClick={handleCleanLogs}>
                        정리하기
                    </Button>
                </div>
            </Card>

            {/* 이미지 정리 */}
            <Card
                title="이미지 정리"
                subtitle="사용되지 않는 이미지 파일을 찾아 삭제합니다."
                icon={<i className="fas fa-image" />}>
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">대상</label>
                            <Select
                                value={imageTarget}
                                onValueChange={(v) => { setImageTarget(v); setHasPreviewed(false); }}
                                items={targetItems}
                            />
                        </div>
                        <div className="flex items-end">
                            <Checkbox
                                checked={removeDuplicates}
                                onCheckedChange={(v) => { setRemoveDuplicates(v); setHasPreviewed(false); }}
                                label="중복 파일 제거"
                                description="동일한 해시의 중복 파일도 함께 정리합니다."
                            />
                        </div>
                    </div>
                    {imageResult && (
                        <Alert variant={imageResult.dryRun ? 'info' : 'success'}>
                            <div className="space-y-1">
                                <p>미사용 파일: {imageResult.totalUnused}개 ({imageResult.totalSizeMb} MB)</p>
                                {imageResult.totalDuplicates > 0 && (
                                    <p>중복 파일: {imageResult.totalDuplicates}개 ({imageResult.totalDuplicateSizeMb} MB)</p>
                                )}
                                <p>절약 용량: {imageResult.totalSavedMb} MB</p>
                                {imageResult.messages.length > 0 && (
                                    <ul className="mt-2 text-xs space-y-0.5">
                                        {imageResult.messages.map((msg, i) => (
                                            <li key={i}>{msg}</li>
                                        ))}
                                    </ul>
                                )}
                                {imageResult.dryRun && imageResult.unusedFiles && imageResult.unusedFiles.length > 0 && (
                                    <details className="mt-3">
                                        <summary className="text-xs font-medium cursor-pointer select-none">
                                            삭제 대상 이미지 ({imageResult.unusedFiles.length}
                                            {imageResult.totalUnused > imageResult.unusedFiles.length
                                                ? ` / ${imageResult.totalUnused}`
                                                : ''}개)
                                        </summary>
                                        <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-80 overflow-y-auto">
                                            {imageResult.unusedFiles.map((file, i) => (
                                                <div key={i} className="group relative">
                                                    <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                                                        <img
                                                            src={file.url}
                                                            alt={file.path}
                                                            loading="lazy"
                                                            className="w-full h-full object-cover"
                                                            onError={(e) => {
                                                                e.currentTarget.style.display = 'none';
                                                                e.currentTarget.parentElement!.classList.add(
                                                                    'flex', 'items-center', 'justify-center'
                                                                );
                                                                e.currentTarget.parentElement!.innerHTML = '<i class="fas fa-file-image text-gray-300 text-xl"></i>';
                                                            }}
                                                        />
                                                    </div>
                                                    <div className="mt-1 text-[10px] text-gray-500 truncate" title={file.path}>
                                                        {file.sizeKb} KB
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </details>
                                )}
                                {imageResult.dryRun && imageResult.duplicateFiles && imageResult.duplicateFiles.length > 0 && (
                                    <details className="mt-3">
                                        <summary className="text-xs font-medium cursor-pointer select-none">
                                            중복 파일 ({imageResult.duplicateFiles.length}개)
                                        </summary>
                                        <div className="mt-3 space-y-2 max-h-80 overflow-y-auto">
                                            {imageResult.duplicateFiles.map((dup, i) => (
                                                <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50">
                                                    <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-gray-100 border border-red-200">
                                                        <img
                                                            src={dup.duplicateUrl}
                                                            alt="삭제 대상"
                                                            loading="lazy"
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </div>
                                                    <div className="flex-shrink-0 text-gray-400">
                                                        <i className="fas fa-arrow-right" />
                                                    </div>
                                                    <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-gray-100 border border-green-200">
                                                        <img
                                                            src={dup.originalUrl}
                                                            alt="원본 유지"
                                                            loading="lazy"
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </div>
                                                    <div className="text-[10px] text-gray-500">
                                                        <span className="text-red-500">{dup.duplicateSizeKb} KB</span>
                                                        {' → '}
                                                        <span className="text-green-600">{dup.originalSizeKb} KB</span>
                                                        <span className="ml-1 text-gray-400">({dup.hash})</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </details>
                                )}
                            </div>
                        </Alert>
                    )}
                    <div className="flex gap-2">
                        <Button
                            variant="secondary"
                            size="sm"
                            compact
                            isLoading={imageMutation.isPending && imageMutation.variables?.dryRun === true}
                            onClick={() => imageMutation.mutate({
                                dryRun: true,
                                target: imageTarget,
                                removeDups: removeDuplicates
                            })}>
                            미리보기
                        </Button>
                        <Button
                            variant="primary"
                            size="sm"
                            compact
                            disabled={!hasPreviewed}
                            isLoading={imageMutation.isPending && imageMutation.variables?.dryRun === false}
                            onClick={handleCleanImages}>
                            정리하기
                        </Button>
                    </div>
                </div>
            </Card>
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
    <div className="bg-gray-50 rounded-xl p-4">
        <div className="text-xs text-gray-500 mb-1">{label}</div>
        <div className="text-lg font-bold text-gray-900">{typeof value === 'number' ? value.toLocaleString() : value}</div>
    </div>
);

export default UtilitySetting;
