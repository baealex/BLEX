import { useEffect, useState } from 'react';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Toggle } from '@blex/ui/toggle';
import { Button, Card, Input } from '~/components/shared';
import { toast } from '~/utils/toast';
import { getSiteSettings, updateSiteSettings } from '~/lib/api/settings';
import { SettingsHeader } from '../../components';

const seoExposureItems = [
    {
        icon: 'fa-route',
        name: 'robots.txt',
        path: '/robots.txt',
        description: '현재 설정과 기본 정책을 합쳐 생성하는 공개 크롤러 정책입니다.'
    },
    {
        icon: 'fa-code',
        name: 'Robots meta',
        path: 'noindex, nofollow',
        description: 'SEO가 꺼지면 HTML 페이지에 색인하지 말라는 신호를 함께 붙입니다.'
    },
    {
        icon: 'fa-sitemap',
        name: 'Sitemap 안내',
        path: '/sitemap.xml',
        description: 'SEO가 켜져 있을 때만 robots.txt에서 sitemap 위치를 알려 공개 페이지 발견을 돕습니다.'
    },
    {
        icon: 'fa-pen-to-square',
        name: '추가 robots 규칙',
        path: 'runtime setting',
        description: '관리자가 저장한 Allow, Disallow, User-agent, Sitemap 규칙을 배포 없이 즉시 반영합니다.'
    }
];

const aeoExposureItems = [
    {
        icon: 'fa-file-lines',
        name: 'llms.txt',
        path: '/llms.txt',
        description: 'AI 에이전트가 사이트의 기본 정보를 먼저 확인할 수 있는 공개 안내 파일입니다.'
    },
    {
        icon: 'fa-markdown',
        name: 'Markdown endpoint',
        path: '/@user/post.md, /static/page.md',
        description: '포스트, 시리즈, 정적 페이지를 HTML 대신 읽기 쉬운 Markdown 형식으로 제공하는 주소입니다.'
    },
    {
        icon: 'fa-signs-post',
        name: 'Discovery header',
        path: 'Link, X-Llms-Txt, rel=alternate',
        description: '브라우저 화면에는 보이지 않지만, 에이전트와 크롤러가 AI용 Markdown 주소를 발견하도록 알려주는 신호입니다.'
    },
    {
        icon: 'fa-route',
        name: 'robots.txt',
        path: '/robots.txt',
        description: 'AEO가 켜지면 llms.txt 위치를 안내하고, 꺼지면 llms.txt와 .md 주소 접근을 막도록 안내합니다.'
    }
];

const robotsRuleTemplates = [
    {
        icon: 'fa-folder-minus',
        title: '경로 차단',
        description: '검색엔진이 보지 않았으면 하는 경로를 막습니다.',
        snippet: 'Disallow: /private/'
    },
    {
        icon: 'fa-folder-open',
        title: '경로 허용',
        description: '상위 규칙으로 막힌 경로 안에서 일부만 열어둡니다.',
        snippet: 'Allow: /public/'
    },
    {
        icon: 'fa-ban',
        title: '크롤러별 차단',
        description: '특정 크롤러에만 별도 정책을 적용합니다.',
        snippet: 'User-agent: ExampleBot\nDisallow: /'
    },
    {
        icon: 'fa-sitemap',
        title: 'sitemap 추가',
        description: '별도로 관리하는 sitemap 주소를 함께 알립니다.',
        snippet: 'Sitemap: https://example.com/custom-sitemap.xml'
    }
];

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

    const [seoEnabled, setSeoEnabled] = useState(true);
    const [aeoEnabled, setAeoEnabled] = useState(false);
    const [robotsTxtExtraRules, setRobotsTxtExtraRules] = useState('');
    const [robotsTxtDefault, setRobotsTxtDefault] = useState('');

    useEffect(() => {
        setSeoEnabled(settingData.seoEnabled);
        setAeoEnabled(settingData.aeoEnabled);
        setRobotsTxtExtraRules(settingData.robotsTxtExtraRules);
        setRobotsTxtDefault(settingData.robotsTxtDefault);
    }, [settingData]);

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
            if (data.status === 'DONE') {
                setRobotsTxtExtraRules(data.body.robotsTxtExtraRules);
                setRobotsTxtDefault(data.body.robotsTxtDefault);
            } else {
                setRobotsTxtExtraRules(rules);
            }
            void queryClient.invalidateQueries({ queryKey: ['site-settings'] });
            toast.success('robots.txt 설정이 저장되었습니다.');
        },
        onError: () => {
            setRobotsTxtExtraRules(settingData.robotsTxtExtraRules);
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
        setRobotsTxtExtraRules((current) => {
            const trimmedCurrent = current.trimEnd();
            return trimmedCurrent ? `${trimmedCurrent}\n\n${snippet}` : snippet;
        });
    };

    const normalizedRobotsTxtDefault = robotsTxtDefault.trim();
    const normalizedRobotsTxtExtraRules = robotsTxtExtraRules.trim();
    const robotsTxtPreview = [
        normalizedRobotsTxtDefault,
        normalizedRobotsTxtExtraRules ? `# Custom rules\n${normalizedRobotsTxtExtraRules}` : ''
    ].filter(Boolean).join('\n\n');

    return (
        <div className="space-y-8">
            <SettingsHeader
                title="SEO/AEO"
                description="검색엔진과 인공지능 에이전트 노출 정책을 관리합니다."
            />

            <Card
                title="SEO 노출"
                subtitle="검색엔진이 공개 페이지를 수집하고 색인할 수 있게 할지 결정합니다."
                icon={<i className="fas fa-magnifying-glass" />}>
                <div className="space-y-6">
                    <p className="text-sm leading-relaxed text-content-secondary">
                        이 스위치는 검색엔진에 보내는 색인 허용 신호를 제어합니다.
                        꺼두면 sitemap 안내를 멈추고, 페이지 응답과 HTML에는 noindex 신호를 붙입니다.
                    </p>

                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                            <div className="text-sm font-semibold text-content">SEO 활성화</div>
                            <p className="text-xs leading-relaxed text-content-secondary">
                                켜면 검색엔진에 공개 페이지 수집과 sitemap 위치를 안내합니다.
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-medium text-content-secondary">
                                {seoEnabled ? 'ON' : 'OFF'}
                            </span>
                            <Toggle
                                checked={seoEnabled}
                                disabled={seoMutation.isPending}
                                onCheckedChange={handleSeoChange}
                                aria-label="SEO 검색엔진 노출 활성화"
                            />
                        </div>
                    </div>

                    <div className="grid gap-3 border-t border-line pt-5 sm:grid-cols-2">
                        <div className="rounded-xl bg-surface-subtle px-4 py-3">
                            <div className="text-xs font-semibold uppercase text-content-hint">ON</div>
                            <p className="mt-1 text-sm leading-relaxed text-content-secondary">
                                robots.txt가 sitemap 위치를 안내하고 페이지는 index 신호를 유지합니다.
                            </p>
                        </div>
                        <div className="rounded-xl bg-surface-subtle px-4 py-3">
                            <div className="text-xs font-semibold uppercase text-content-hint">OFF</div>
                            <p className="mt-1 text-sm leading-relaxed text-content-secondary">
                                robots.txt에서 sitemap을 숨기고 페이지 응답에는 noindex,nofollow를 붙입니다.
                            </p>
                        </div>
                    </div>
                </div>
            </Card>

            <Card
                title="robots.txt 런타임 규칙"
                subtitle="기본 정책 뒤에 붙일 robots.txt 규칙을 배포 없이 관리합니다."
                icon={<i className="fas fa-route" />}>
                <div className="space-y-6">
                    <div className="rounded-xl border border-line bg-surface-subtle p-4">
                        <div className="grid gap-3 text-sm text-content-secondary sm:grid-cols-3">
                            <div>
                                <div className="font-semibold text-content">기본 차단</div>
                                <p className="mt-1 leading-relaxed">관리자, 설정, 작성, API 경로</p>
                            </div>
                            <div>
                                <div className="font-semibold text-content">SEO ON</div>
                                <p className="mt-1 leading-relaxed">sitemap 위치 안내</p>
                            </div>
                            <div>
                                <div className="font-semibold text-content">SEO OFF</div>
                                <p className="mt-1 leading-relaxed">sitemap 숨김, noindex 헤더 적용</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <h3 className="text-sm font-semibold text-content">기본 생성 내용</h3>
                                <p className="mt-1 text-xs leading-relaxed text-content-secondary">
                                    SEO/AEO 스위치와 기본 차단 정책으로 자동 생성되는 내용입니다.
                                </p>
                            </div>
                            <code className="w-fit rounded-md bg-surface-subtle px-2 py-1 text-xs text-content-secondary">
                                /robots.txt
                            </code>
                        </div>
                        <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-line bg-surface-elevated p-4 font-mono text-xs leading-relaxed text-content-secondary">{normalizedRobotsTxtDefault || '기본 생성 내용을 불러오는 중입니다.'}</pre>
                    </div>

                    <div className="space-y-3">
                        <div>
                            <h3 className="text-sm font-semibold text-content">규칙 빠른 추가</h3>
                            <p className="mt-1 text-xs leading-relaxed text-content-secondary">
                                필요한 조각을 추가한 뒤 경로나 크롤러 이름만 바꿔 저장합니다.
                            </p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            {robotsRuleTemplates.map((template) => (
                                <button
                                    key={template.title}
                                    type="button"
                                    onClick={() => handleAppendRobotsSnippet(template.snippet)}
                                    className="group rounded-lg border border-line bg-surface-elevated p-4 text-left transition-colors hover:border-line-strong hover:bg-surface-subtle focus:outline-none focus:ring-2 focus:ring-line/70">
                                    <div className="flex items-start gap-3">
                                        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-content-secondary transition-colors group-hover:text-content">
                                            <i className={`fas ${template.icon}`} />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-sm font-semibold text-content">{template.title}</span>
                                            <span className="mt-1 block text-xs leading-relaxed text-content-secondary">
                                                {template.description}
                                            </span>
                                            <code className="mt-3 block whitespace-pre-wrap break-all rounded-md bg-surface-subtle px-3 py-2 font-mono text-xs leading-relaxed text-content-secondary">{template.snippet}</code>
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div>
                            <label className="block text-sm font-semibold text-content">
                                추가 규칙
                            </label>
                            <p className="mt-1 text-xs leading-relaxed text-content-secondary">
                                아래 내용은 기본 생성 내용 뒤에 붙습니다. 비워두면 기본 정책만 사용합니다.
                            </p>
                        </div>
                        <Input
                            multiline
                            rows={7}
                            value={robotsTxtExtraRules}
                            onChange={(event) => setRobotsTxtExtraRules(event.target.value)}
                            placeholder={'User-agent: ExampleBot\nDisallow: /private/'}
                            className="font-mono text-sm"
                        />
                    </div>

                    <div className="space-y-3">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <h3 className="text-sm font-semibold text-content">저장 후 미리보기</h3>
                                <p className="mt-1 text-xs leading-relaxed text-content-secondary">
                                    지금 입력한 추가 규칙까지 포함해 공개될 전체 내용입니다.
                                </p>
                            </div>
                            <span className="w-fit rounded-md bg-surface-subtle px-2 py-1 text-xs font-medium text-content-secondary">
                                {normalizedRobotsTxtExtraRules ? '추가 규칙 포함' : '기본 정책만'}
                            </span>
                        </div>
                        <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-line bg-surface-elevated p-4 font-mono text-xs leading-relaxed text-content-secondary">{robotsTxtPreview || '미리보기 내용을 불러오는 중입니다.'}</pre>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                        <Button
                            variant="secondary"
                            size="md"
                            disabled={!normalizedRobotsTxtExtraRules || robotsMutation.isPending}
                            onClick={() => setRobotsTxtExtraRules('')}
                            leftIcon={<i className="fas fa-rotate-left" />}>
                            추가 규칙 비우기
                        </Button>
                        <Button
                            variant="primary"
                            size="md"
                            isLoading={robotsMutation.isPending}
                            onClick={handleRobotsSave}
                            leftIcon={!robotsMutation.isPending ? <i className="fas fa-save" /> : undefined}>
                            {robotsMutation.isPending ? '저장 중...' : 'robots.txt 저장'}
                        </Button>
                    </div>
                </div>
            </Card>

            <Card
                title="AEO 노출"
                subtitle="AI 에이전트가 사이트와 공개 콘텐츠를 읽기 쉽게 찾을 수 있도록 별도 진입점을 열지 결정합니다."
                icon={<i className="fas fa-robot" />}>
                <div className="space-y-6">
                    <p className="text-sm leading-relaxed text-content-secondary">
                        이 스위치는 일반 검색엔진용 SEO가 아니라 AI 에이전트용 노출 표면만 제어합니다.
                        꺼두면 AI용 주소는 404로 숨기고, 페이지와 응답 헤더에서도 발견 신호를 제거합니다.
                    </p>

                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                            <div className="text-sm font-semibold text-content">AEO 활성화</div>
                            <p className="text-xs leading-relaxed text-content-secondary">
                                켜면 아래의 AI용 진입점, Markdown 주소, 발견 헤더가 함께 공개됩니다.
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-medium text-content-secondary">
                                {aeoEnabled ? 'ON' : 'OFF'}
                            </span>
                            <Toggle
                                checked={aeoEnabled}
                                disabled={aeoMutation.isPending}
                                onCheckedChange={handleAeoChange}
                                aria-label="AEO 인공지능 노출 활성화"
                            />
                        </div>
                    </div>

                    <div className="grid gap-3 border-t border-line pt-5 sm:grid-cols-2">
                        <div className="rounded-xl bg-surface-subtle px-4 py-3">
                            <div className="text-xs font-semibold uppercase text-content-hint">ON</div>
                            <p className="mt-1 text-sm leading-relaxed text-content-secondary">
                                AI용 주소가 열리고 페이지와 응답 헤더가 Markdown 위치를 안내합니다.
                            </p>
                        </div>
                        <div className="rounded-xl bg-surface-subtle px-4 py-3">
                            <div className="text-xs font-semibold uppercase text-content-hint">OFF</div>
                            <p className="mt-1 text-sm leading-relaxed text-content-secondary">
                                AI용 주소는 404로 숨겨지고 robots.txt는 해당 경로를 허용하지 않도록 안내합니다.
                            </p>
                        </div>
                    </div>
                </div>
            </Card>

            <Card
                title="제어되는 노출면"
                subtitle="각 스위치가 실제로 바꾸는 공개 표면입니다."
                icon={<i className="fas fa-diagram-project" />}>
                <div className="space-y-6">
                    <section className="space-y-3">
                        <h3 className="text-sm font-semibold text-content">SEO</h3>
                        <div className="divide-y divide-line rounded-xl border border-line">
                            {seoExposureItems.map((item) => (
                                <div key={item.name} className="flex gap-4 p-4">
                                    <div className="mt-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-content-secondary">
                                        <i className={`fas ${item.icon}`} />
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
                            ))}
                        </div>
                    </section>

                    <section className="space-y-3">
                        <h3 className="text-sm font-semibold text-content">AEO</h3>
                        <div className="divide-y divide-line rounded-xl border border-line">
                            {aeoExposureItems.map((item) => (
                                <div key={item.name} className="flex gap-4 p-4">
                                    <div className="mt-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-content-secondary">
                                        <i className={`fas ${item.icon}`} />
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
                            ))}
                        </div>
                    </section>
                </div>
            </Card>
        </div>
    );
};

export default SeoAeoSetting;
