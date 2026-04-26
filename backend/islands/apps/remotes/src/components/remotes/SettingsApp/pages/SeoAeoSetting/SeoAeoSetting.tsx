import { useEffect, useState } from 'react';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { Toggle } from '@blex/ui/toggle';
import { Card } from '~/components/shared';
import { toast } from '~/utils/toast';
import { getSiteSettings, updateSiteSettings } from '~/lib/api/settings';
import { SettingsHeader } from '../../components';

const seoExposureItems = [
    {
        icon: 'fa-route',
        name: 'robots.txt',
        path: '/robots.txt',
        description: '검색엔진 크롤러가 사이트를 수집해도 되는지 먼저 확인하는 공개 정책 파일입니다.'
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
        description: 'SEO가 켜져 있을 때 robots.txt에서 sitemap 위치를 알려 공개 페이지 발견을 돕습니다.'
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

const SeoAeoSetting = () => {
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

    useEffect(() => {
        setSeoEnabled(settingData.seoEnabled);
        setAeoEnabled(settingData.aeoEnabled);
    }, [settingData]);

    const seoMutation = useMutation({
        mutationFn: (enabled: boolean) => updateSiteSettings({ seo_enabled: enabled }),
        onSuccess: (_, enabled) => {
            setSeoEnabled(enabled);
            toast.success('SEO 설정이 저장되었습니다.');
        },
        onError: () => {
            setSeoEnabled(settingData.seoEnabled);
            toast.error('SEO 설정 저장에 실패했습니다.');
        }
    });

    const aeoMutation = useMutation({
        mutationFn: (enabled: boolean) => updateSiteSettings({ aeo_enabled: enabled }),
        onSuccess: (_, enabled) => {
            setAeoEnabled(enabled);
            toast.success('AEO 설정이 저장되었습니다.');
        },
        onError: () => {
            setAeoEnabled(settingData.aeoEnabled);
            toast.error('AEO 설정 저장에 실패했습니다.');
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
                        꺼두면 robots.txt는 사이트 전체 수집을 막고, HTML 페이지에는 noindex 신호를 붙입니다.
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
                                robots.txt가 공개 페이지 수집을 허용하고 sitemap 위치를 안내합니다.
                            </p>
                        </div>
                        <div className="rounded-xl bg-surface-subtle px-4 py-3">
                            <div className="text-xs font-semibold uppercase text-content-hint">OFF</div>
                            <p className="mt-1 text-sm leading-relaxed text-content-secondary">
                                robots.txt가 Disallow: /로 전체 수집을 막고 페이지에는 noindex,nofollow를 붙입니다.
                            </p>
                        </div>
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
