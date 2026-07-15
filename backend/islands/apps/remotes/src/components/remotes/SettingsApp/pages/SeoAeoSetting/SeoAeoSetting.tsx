import { useEffect, useState } from 'react';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Toggle } from '@blex/ui/toggle';
import {
    AlertCircle,
    CheckCircle,
    ChevronDown,
    Code2,
    Eye,
    FileText,
    Layers3,
    Loader2,
    Pencil,
    Route,
    RotateCw,
    Save,
    Signpost,
    SlidersHorizontal
} from '@blex/ui/icons';
import type { LucideIcon } from '@blex/ui/icons';
import { Button, Card } from '~/components/shared';
import { CodeEditor } from '~/components/CodeEditor';
import { toast } from '~/utils/toast';
import { getSiteSettings, updateSiteSettings } from '~/lib/api/settings';
import { SettingsHeader } from '../../components';

interface ExposureItem {
    icon: LucideIcon;
    name: string;
    path: string;
    description: string;
}

const seoExposureItems: ExposureItem[] = [
    {
        icon: Route,
        name: 'robots.txt',
        path: '/robots.txt',
        description: '기본 정책과 저장한 추가 규칙을 합쳐 제공합니다.'
    },
    {
        icon: Code2,
        name: 'Robots meta',
        path: 'noindex, nofollow',
        description: 'SEO가 꺼지면 HTML 페이지에 noindex,nofollow를 적용합니다.'
    },
    {
        icon: Layers3,
        name: 'Sitemap 안내',
        path: '/sitemap.xml',
        description: 'SEO가 켜지면 robots.txt에 sitemap 위치를 표시합니다.'
    },
    {
        icon: Pencil,
        name: '추가 robots 규칙',
        path: 'runtime setting',
        description: '저장한 규칙을 배포 없이 즉시 반영합니다.'
    }
];

const aeoExposureItems: ExposureItem[] = [
    {
        icon: FileText,
        name: 'llms.txt',
        path: '/llms.txt',
        description: 'AI 에이전트에 사이트 정보를 제공하는 공개 안내 파일입니다.'
    },
    {
        icon: Code2,
        name: 'Markdown endpoint',
        path: '/@user/post.md, /static/page.md',
        description: '포스트·시리즈·정적 페이지를 Markdown으로 제공합니다.'
    },
    {
        icon: Signpost,
        name: 'Discovery header',
        path: 'Link, X-Llms-Txt, rel=alternate',
        description: '응답 헤더와 alternate 링크로 Markdown 주소를 알립니다.'
    },
    {
        icon: Route,
        name: 'robots.txt',
        path: '/robots.txt',
        description: 'AEO 상태에 따라 llms.txt와 .md 경로의 허용·차단 규칙을 제공합니다.'
    }
];

const robotsRuleTemplates = [
    {
        title: '경로 차단',
        snippet: 'Disallow: /private/'
    },
    {
        title: '경로 허용',
        snippet: 'Allow: /public/'
    },
    {
        title: '크롤러별 차단',
        snippet: 'User-agent: ExampleBot\nDisallow: /'
    },
    {
        title: 'sitemap 추가',
        snippet: 'Sitemap: https://example.com/custom-sitemap.xml'
    }
];

interface SaveStatusProps {
    isPending: boolean;
    isError: boolean;
}

const SaveStatus = ({ isPending, isError }: SaveStatusProps) => {
    if (isPending) {
        return (
            <p role="status" className="mt-3 flex items-center gap-1.5 text-xs font-medium text-content-secondary">
                <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
                설정 저장 중
            </p>
        );
    }

    if (isError) {
        return (
            <p role="alert" className="mt-3 flex items-center gap-1.5 text-xs font-medium text-danger">
                <AlertCircle aria-hidden="true" className="h-3.5 w-3.5" />
                저장 실패 · 다시 시도해주세요
            </p>
        );
    }

    return (
        <p role="status" className="mt-3 flex items-center gap-1.5 text-xs font-medium text-success">
            <CheckCircle aria-hidden="true" className="h-3.5 w-3.5" />
            현재 설정 적용됨
        </p>
    );
};

const SeoAeoSetting = () => {
    const queryClient = useQueryClient();
    const { data: settingData } = useSuspenseQuery({
        queryKey: ['site-settings'],
        queryFn: async () => {
            const { data } = await getSiteSettings();
            if (data.status === 'DONE') {
                return data.body;
            }
            throw new Error('SEO/AEO 설정을 불러오는데 실패했습니다.');
        }
    });

    const [seoEnabled, setSeoEnabled] = useState(settingData.seoEnabled);
    const [aeoEnabled, setAeoEnabled] = useState(settingData.aeoEnabled);
    const [robotsTxtExtraRules, setRobotsTxtExtraRules] = useState(settingData.robotsTxtExtraRules);
    const [savedRobotsTxtExtraRules, setSavedRobotsTxtExtraRules] = useState(settingData.robotsTxtExtraRules);
    const [robotsTxtDefault, setRobotsTxtDefault] = useState(settingData.robotsTxtDefault);
    const [isRobotsAdvancedOpen, setIsRobotsAdvancedOpen] = useState(false);

    useEffect(() => {
        setSeoEnabled(settingData.seoEnabled);
    }, [settingData.seoEnabled]);

    useEffect(() => {
        setAeoEnabled(settingData.aeoEnabled);
    }, [settingData.aeoEnabled]);

    useEffect(() => {
        setRobotsTxtExtraRules(settingData.robotsTxtExtraRules);
        setSavedRobotsTxtExtraRules(settingData.robotsTxtExtraRules);
    }, [settingData.robotsTxtExtraRules]);

    useEffect(() => {
        setRobotsTxtDefault(settingData.robotsTxtDefault);
    }, [settingData.robotsTxtDefault]);

    const seoMutation = useMutation({
        mutationFn: (enabled: boolean) => updateSiteSettings({ seo_enabled: enabled }),
        onSuccess: ({ data }, enabled) => {
            setSeoEnabled(enabled);
            if (data.status === 'DONE') {
                setRobotsTxtDefault(data.body.robotsTxtDefault);
            }
            void queryClient.invalidateQueries({ queryKey: ['site-settings'] });
            toast.success('SEO 설정이 저장되었습니다.');
        },
        onError: () => {
            setSeoEnabled(settingData.seoEnabled);
            toast.error('SEO 설정 저장에 실패했습니다.');
        }
    });

    const aeoMutation = useMutation({
        mutationFn: (enabled: boolean) => updateSiteSettings({ aeo_enabled: enabled }),
        onSuccess: ({ data }, enabled) => {
            setAeoEnabled(enabled);
            if (data.status === 'DONE') {
                setRobotsTxtDefault(data.body.robotsTxtDefault);
            }
            void queryClient.invalidateQueries({ queryKey: ['site-settings'] });
            toast.success('AEO 설정이 저장되었습니다.');
        },
        onError: () => {
            setAeoEnabled(settingData.aeoEnabled);
            toast.error('AEO 설정 저장에 실패했습니다.');
        }
    });

    const robotsMutation = useMutation({
        mutationFn: (rules: string) => updateSiteSettings({ robots_txt_extra_rules: rules }),
        onSuccess: ({ data }, rules) => {
            const savedRules = data.status === 'DONE' ? data.body.robotsTxtExtraRules : rules;
            if (data.status === 'DONE') {
                setRobotsTxtDefault(data.body.robotsTxtDefault);
            }
            setRobotsTxtExtraRules(savedRules);
            setSavedRobotsTxtExtraRules(savedRules);
            void queryClient.invalidateQueries({ queryKey: ['site-settings'] });
            toast.success('robots.txt 설정이 저장되었습니다.');
        },
        onError: () => {
            setRobotsTxtExtraRules(savedRobotsTxtExtraRules);
            toast.error('robots.txt 설정 저장에 실패했습니다.');
        }
    });

    const handleSeoChange = (enabled: boolean) => {
        setSeoEnabled(enabled);
        seoMutation.mutate(enabled);
    };

    const handleAeoChange = (enabled: boolean) => {
        setAeoEnabled(enabled);
        aeoMutation.mutate(enabled);
    };

    const handleRobotsSave = () => {
        robotsMutation.mutate(robotsTxtExtraRules);
    };

    const handleAppendRobotsSnippet = (snippet: string) => {
        if (robotsMutation.isError) robotsMutation.reset();
        setRobotsTxtExtraRules((current) => {
            const trimmedCurrent = current.trimEnd();
            return trimmedCurrent ? `${trimmedCurrent}\n\n${snippet}` : snippet;
        });
    };

    const handleRobotsRulesChange = (value: string) => {
        if (robotsMutation.isError) robotsMutation.reset();
        setRobotsTxtExtraRules(value);
    };

    const normalizedRobotsTxtDefault = robotsTxtDefault.trim();
    const normalizedRobotsTxtExtraRules = robotsTxtExtraRules.trim();
    const normalizedSavedRobotsTxtExtraRules = savedRobotsTxtExtraRules.trim();
    const hasUnsavedRobotsChanges = robotsTxtExtraRules !== savedRobotsTxtExtraRules;
    const savedRobotsRuleLineCount = normalizedSavedRobotsTxtExtraRules
        ? normalizedSavedRobotsTxtExtraRules.split(/\r?\n/).filter(line => line.trim()).length
        : 0;
    const robotsStatus = robotsMutation.isPending
        ? '추가 규칙 저장 중'
        : robotsMutation.isError
            ? '저장 실패 · 기존 규칙 유지됨'
            : hasUnsavedRobotsChanges
                ? '저장되지 않은 변경 있음'
                : savedRobotsRuleLineCount > 0
                    ? `추가 규칙 ${savedRobotsRuleLineCount}줄 적용 중`
                    : '기본 정책만 적용 중';
    const robotsTxtPreview = [
        normalizedRobotsTxtDefault,
        normalizedRobotsTxtExtraRules ? `# Custom rules\n${normalizedRobotsTxtExtraRules}` : ''
    ].filter(Boolean).join('\n\n');

    return (
        <div className="space-y-8">
            <SettingsHeader title="SEO/AEO" />

            <Card
                title="현재 노출 상태"
                icon={<Eye aria-hidden="true" className="h-5 w-5" />}>
                <div className="grid gap-4 lg:grid-cols-2">
                    <section
                        aria-labelledby="seo-exposure-title"
                        className="rounded-xl border border-line bg-surface-elevated p-4 sm:p-5">
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                                <h3 id="seo-exposure-title" className="text-sm font-semibold text-content">
                                    SEO · 검색엔진
                                </h3>
                                <p className="mt-2 text-sm leading-relaxed text-content-secondary">
                                    {seoEnabled
                                        ? '페이지 색인을 허용하고 robots.txt에서 sitemap 위치를 안내합니다.'
                                        : 'sitemap 안내를 숨기고 페이지에 noindex,nofollow를 적용합니다.'}
                                </p>
                            </div>
                            <Toggle
                                checked={seoEnabled}
                                disabled={seoMutation.isPending}
                                onCheckedChange={handleSeoChange}
                                aria-label="SEO 검색엔진 노출 활성화"
                            />
                        </div>
                        <SaveStatus isPending={seoMutation.isPending} isError={seoMutation.isError} />
                    </section>

                    <section
                        aria-labelledby="aeo-exposure-title"
                        className="rounded-xl border border-line bg-surface-elevated p-4 sm:p-5">
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                                <h3 id="aeo-exposure-title" className="text-sm font-semibold text-content">
                                    AEO · AI 에이전트
                                </h3>
                                <p className="mt-2 text-sm leading-relaxed text-content-secondary">
                                    {aeoEnabled
                                        ? 'llms.txt와 Markdown 주소를 공개하고 발견 신호를 제공합니다.'
                                        : 'AI 전용 주소를 404로 숨기고 발견 신호를 제거합니다.'}
                                </p>
                            </div>
                            <Toggle
                                checked={aeoEnabled}
                                disabled={aeoMutation.isPending}
                                onCheckedChange={handleAeoChange}
                                aria-label="AEO 인공지능 노출 활성화"
                            />
                        </div>
                        <SaveStatus isPending={aeoMutation.isPending} isError={aeoMutation.isError} />
                    </section>
                </div>
            </Card>

            <details
                className="group overflow-hidden rounded-2xl bg-surface ring-1 ring-line/60"
                onToggle={(event) => setIsRobotsAdvancedOpen(event.currentTarget.open)}>
                <summary className="flex min-h-20 cursor-pointer list-none items-center gap-4 px-6 py-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-line-strong md:px-8 [&::-webkit-details-marker]:hidden">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-subtle text-content-secondary">
                        <SlidersHorizontal aria-hidden="true" className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block text-base font-semibold text-content">robots.txt 고급 설정</span>
                        <span
                            aria-live="polite"
                            className={`mt-1 block text-sm ${robotsMutation.isError ? 'text-danger' : hasUnsavedRobotsChanges ? 'text-warning' : 'text-content-secondary'}`}>
                            {robotsStatus}
                        </span>
                    </span>
                    <ChevronDown
                        aria-hidden="true"
                        className="h-5 w-5 shrink-0 text-content-hint transition-transform group-open:rotate-180 motion-reduce:transition-none"
                    />
                </summary>

                {isRobotsAdvancedOpen && (
                    <div className="space-y-6 border-t border-line px-6 py-6 md:px-8 md:py-8">
                        <section className="space-y-3" aria-labelledby="robots-template-title">
                            <h3 id="robots-template-title" className="text-sm font-semibold text-content">규칙 빠른 추가</h3>
                            <div className="grid gap-2 sm:grid-cols-2">
                                {robotsRuleTemplates.map((template) => (
                                    <button
                                        key={template.title}
                                        type="button"
                                        onClick={() => handleAppendRobotsSnippet(template.snippet)}
                                        className="min-h-11 rounded-lg border border-line bg-surface-elevated px-3 py-2 text-left transition-colors hover:border-line-strong hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-strong motion-reduce:transition-none">
                                        <span className="block text-xs font-semibold text-content">{template.title}</span>
                                        <code className="mt-1 block whitespace-pre-wrap break-all font-mono text-xs text-content-secondary">
                                            {template.snippet}
                                        </code>
                                    </button>
                                ))}
                            </div>
                        </section>

                        <section className="space-y-2" aria-labelledby="robots-editor-title">
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                <h3 id="robots-editor-title" className="text-sm font-semibold text-content">추가 규칙 편집</h3>
                                <span className="text-xs text-content-secondary">기본 생성 내용 뒤에 그대로 추가됩니다.</span>
                            </div>
                            <CodeEditor
                                ariaLabel="robots.txt 추가 규칙"
                                language="plaintext"
                                value={robotsTxtExtraRules}
                                onChange={handleRobotsRulesChange}
                                height="260px"
                            />
                        </section>

                        <details className="group/preview rounded-xl border border-line bg-surface-elevated">
                            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-line-strong [&::-webkit-details-marker]:hidden">
                                <span className="min-w-0 flex-1 text-sm font-semibold text-content">robots.txt 전체 미리보기</span>
                                <span className="text-xs text-content-secondary">
                                    {normalizedRobotsTxtExtraRules ? '추가 규칙 포함' : '기본 정책만'}
                                </span>
                                <ChevronDown
                                    aria-hidden="true"
                                    className="h-4 w-4 shrink-0 text-content-hint transition-transform group-open/preview:rotate-180 motion-reduce:transition-none"
                                />
                            </summary>
                            <div className="border-t border-line p-4">
                                <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-surface-subtle p-4 font-mono text-xs leading-relaxed text-content-secondary">{robotsTxtPreview || '미리보기 내용을 불러오는 중입니다.'}</pre>
                            </div>
                        </details>

                        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                            <Button
                                density="compact"
                                variant="secondary"
                                size="md"
                                disabled={!normalizedRobotsTxtExtraRules || robotsMutation.isPending}
                                onClick={() => handleRobotsRulesChange('')}
                                leftIcon={<RotateCw aria-hidden="true" className="h-4 w-4" />}>
                                추가 규칙 비우기
                            </Button>
                            <Button
                                density="compact"
                                variant="primary"
                                size="md"
                                isLoading={robotsMutation.isPending}
                                onClick={handleRobotsSave}
                                leftIcon={!robotsMutation.isPending ? <Save aria-hidden="true" className="h-4 w-4" /> : undefined}>
                                {robotsMutation.isPending ? '저장 중...' : 'robots.txt 저장'}
                            </Button>
                        </div>
                    </div>
                )}
            </details>

            <details className="group overflow-hidden rounded-2xl bg-surface ring-1 ring-line/60">
                <summary className="flex min-h-20 cursor-pointer list-none items-center gap-4 px-6 py-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-line-strong md:px-8 [&::-webkit-details-marker]:hidden">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-subtle text-content-secondary">
                        <FileText aria-hidden="true" className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block text-base font-semibold text-content">SEO·AEO가 제어하는 공개 노출면</span>
                        <span className="mt-1 block text-sm text-content-secondary">SEO 4개 · AEO 4개 주소와 신호</span>
                    </span>
                    <ChevronDown
                        aria-hidden="true"
                        className="h-5 w-5 shrink-0 text-content-hint transition-transform group-open:rotate-180 motion-reduce:transition-none"
                    />
                </summary>

                <div className="space-y-6 border-t border-line px-6 py-6 md:px-8 md:py-8">
                    <section className="space-y-3">
                        <h3 className="text-sm font-semibold text-content">SEO</h3>
                        <div className="divide-y divide-line rounded-xl border border-line">
                            {seoExposureItems.map((item) => {
                                const ItemIcon = item.icon;
                                return (
                                    <div key={item.name} className="flex gap-4 p-4">
                                        <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-content-secondary">
                                            <ItemIcon aria-hidden="true" className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                                                <h4 className="text-sm font-semibold text-content">{item.name}</h4>
                                                <code className="break-all rounded-md bg-surface-subtle px-2 py-1 text-xs text-content-secondary">
                                                    {item.path}
                                                </code>
                                            </div>
                                            <p className="mt-2 text-sm leading-relaxed text-content-secondary">
                                                {item.description}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    <section className="space-y-3">
                        <h3 className="text-sm font-semibold text-content">AEO</h3>
                        <div className="divide-y divide-line rounded-xl border border-line">
                            {aeoExposureItems.map((item) => {
                                const ItemIcon = item.icon;
                                return (
                                    <div key={item.name} className="flex gap-4 p-4">
                                        <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-content-secondary">
                                            <ItemIcon aria-hidden="true" className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                                                <h4 className="text-sm font-semibold text-content">{item.name}</h4>
                                                <code className="break-all rounded-md bg-surface-subtle px-2 py-1 text-xs text-content-secondary">
                                                    {item.path}
                                                </code>
                                            </div>
                                            <p className="mt-2 text-sm leading-relaxed text-content-secondary">
                                                {item.description}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                </div>
            </details>
        </div>
    );
};

export default SeoAeoSetting;
