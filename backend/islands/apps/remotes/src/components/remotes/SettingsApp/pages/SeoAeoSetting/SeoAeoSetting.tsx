import { useEffect, useState } from 'react';
import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
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
    name: MessageDescriptor;
    path: string;
    description: MessageDescriptor;
}

const seoExposureItems: ExposureItem[] = [
    {
        icon: Route,
        name: msg({
            id: 'settings.seo_aeo.surface.robots_txt',
            message: 'robots.txt'
        }),
        path: '/robots.txt',
        description: msg({
            id: 'settings.seo_aeo.surface.robots_txt.description',
            message: 'Combines the default policy with your saved custom rules.'
        })
    },
    {
        icon: Code2,
        name: msg({
            id: 'settings.seo_aeo.surface.robots_meta',
            message: 'Robots meta tag'
        }),
        path: 'noindex, nofollow',
        description: msg({
            id: 'settings.seo_aeo.surface.robots_meta.description',
            message: 'When SEO is disabled, adds noindex, nofollow to HTML pages.'
        })
    },
    {
        icon: Layers3,
        name: msg({
            id: 'settings.seo_aeo.surface.sitemap_discovery',
            message: 'Sitemap discovery'
        }),
        path: '/sitemap.xml',
        description: msg({
            id: 'settings.seo_aeo.surface.sitemap_discovery.description',
            message: 'When SEO is enabled, lists the sitemap location in robots.txt.'
        })
    },
    {
        icon: Pencil,
        name: msg({
            id: 'settings.seo_aeo.surface.custom_robots_rules',
            message: 'Custom robots rules'
        }),
        path: 'runtime setting',
        description: msg({
            id: 'settings.seo_aeo.surface.custom_robots_rules.description',
            message: 'Applies saved rules immediately without a deployment.'
        })
    }
];

const aeoExposureItems: ExposureItem[] = [
    {
        icon: FileText,
        name: msg({
            id: 'settings.seo_aeo.surface.llms_txt',
            message: 'llms.txt'
        }),
        path: '/llms.txt',
        description: msg({
            id: 'settings.seo_aeo.surface.llms_txt.description',
            message: 'Publishes a site guide for AI agents.'
        })
    },
    {
        icon: Code2,
        name: msg({
            id: 'settings.seo_aeo.surface.markdown_endpoints',
            message: 'Markdown endpoints'
        }),
        path: '/@user/post.md, /static/page.md',
        description: msg({
            id: 'settings.seo_aeo.surface.markdown_endpoints.description',
            message: 'Serves posts, series, and static pages as Markdown.'
        })
    },
    {
        icon: Signpost,
        name: msg({
            id: 'settings.seo_aeo.surface.discovery_headers',
            message: 'Discovery headers'
        }),
        path: 'Link, X-Llms-Txt, rel=alternate',
        description: msg({
            id: 'settings.seo_aeo.surface.discovery_headers.description',
            message: 'Advertises Markdown URLs through response headers and alternate links.'
        })
    },
    {
        icon: Route,
        name: msg({
            id: 'settings.seo_aeo.surface.robots_txt',
            message: 'robots.txt'
        }),
        path: '/robots.txt',
        description: msg({
            id: 'settings.seo_aeo.surface.robots_txt_aeo.description',
            message: 'Serves allow or block rules for llms.txt and .md paths based on the AEO setting.'
        })
    }
];

const robotsRuleTemplates = [
    {
        title: msg({
            id: 'settings.seo_aeo.robots.template.block_path',
            message: 'Block a path'
        }),
        snippet: 'Disallow: /private/'
    },
    {
        title: msg({
            id: 'settings.seo_aeo.robots.template.allow_path',
            message: 'Allow a path'
        }),
        snippet: 'Allow: /public/'
    },
    {
        title: msg({
            id: 'settings.seo_aeo.robots.template.block_crawler',
            message: 'Block a specific crawler'
        }),
        snippet: 'User-agent: ExampleBot\nDisallow: /'
    },
    {
        title: msg({
            id: 'settings.seo_aeo.robots.template.add_sitemap',
            message: 'Add a sitemap'
        }),
        snippet: 'Sitemap: https://example.com/custom-sitemap.xml'
    }
];

interface SaveStatusProps {
    isPending: boolean;
    isError: boolean;
}

const SaveStatus = ({ isPending, isError }: SaveStatusProps) => {
    const { t } = useLingui();

    if (isPending) {
        return (
            <p role="status" className="mt-3 flex items-center gap-1.5 text-xs font-medium text-content-secondary">
                <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
                {t({
                    id: 'settings.seo_aeo.status.saving',
                    message: 'Saving settings'
                })}
            </p>
        );
    }

    if (isError) {
        return (
            <p role="alert" className="mt-3 flex items-center gap-1.5 text-xs font-medium text-danger">
                <AlertCircle aria-hidden="true" className="h-3.5 w-3.5" />
                {t({
                    id: 'settings.seo_aeo.status.save_failed',
                    message: 'Save failed · Try again'
                })}
            </p>
        );
    }

    return (
        <p role="status" className="mt-3 flex items-center gap-1.5 text-xs font-medium text-success">
            <CheckCircle aria-hidden="true" className="h-3.5 w-3.5" />
            {t({
                id: 'settings.seo_aeo.status.applied',
                message: 'Current settings applied'
            })}
        </p>
    );
};

const SeoAeoSetting = () => {
    const { i18n, t } = useLingui();
    const queryClient = useQueryClient();
    const { data: settingData } = useSuspenseQuery({
        queryKey: ['site-settings'],
        queryFn: async () => {
            const { data } = await getSiteSettings();
            if (data.status === 'DONE') {
                return data.body;
            }
            throw new Error(t({
                id: 'settings.seo_aeo.load_error',
                message: 'Failed to load SEO/AEO settings.'
            }));
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
            toast.success(t({
                id: 'settings.seo_aeo.seo.save_success',
                message: 'SEO settings saved.'
            }));
        },
        onError: () => {
            setSeoEnabled(settingData.seoEnabled);
            toast.error(t({
                id: 'settings.seo_aeo.seo.save_error',
                message: 'Failed to save SEO settings.'
            }));
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
            toast.success(t({
                id: 'settings.seo_aeo.aeo.save_success',
                message: 'AEO settings saved.'
            }));
        },
        onError: () => {
            setAeoEnabled(settingData.aeoEnabled);
            toast.error(t({
                id: 'settings.seo_aeo.aeo.save_error',
                message: 'Failed to save AEO settings.'
            }));
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
            toast.success(t({
                id: 'settings.seo_aeo.robots.save_success',
                message: 'robots.txt settings saved.'
            }));
        },
        onError: () => {
            setRobotsTxtExtraRules(savedRobotsTxtExtraRules);
            toast.error(t({
                id: 'settings.seo_aeo.robots.save_error',
                message: 'Failed to save robots.txt settings.'
            }));
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
        ? t({
            id: 'settings.seo_aeo.robots.status.saving',
            message: 'Saving custom rules'
        })
        : robotsMutation.isError
            ? t({
                id: 'settings.seo_aeo.robots.status.save_failed',
                message: 'Save failed · Existing rules kept'
            })
            : hasUnsavedRobotsChanges
                ? t({
                    id: 'settings.seo_aeo.robots.status.unsaved',
                    message: 'Unsaved changes'
                })
                : savedRobotsRuleLineCount > 0
                    ? i18n._({
                        id: 'settings.seo_aeo.robots.status.active_lines',
                        message: '{count, plural, one {# custom rule line active} other {# custom rule lines active}}',
                        values: { count: savedRobotsRuleLineCount }
                    })
                    : t({
                        id: 'settings.seo_aeo.robots.status.default_only',
                        message: 'Default policy only'
                    });
    const robotsTxtPreview = [
        normalizedRobotsTxtDefault,
        normalizedRobotsTxtExtraRules ? `# Custom rules\n${normalizedRobotsTxtExtraRules}` : ''
    ].filter(Boolean).join('\n\n');

    return (
        <div className="space-y-8">
            <SettingsHeader title="SEO/AEO" />

            <Card
                title={t({
                    id: 'settings.seo_aeo.visibility.title',
                    message: 'Current visibility'
                })}
                icon={<Eye aria-hidden="true" className="h-5 w-5" />}>
                <div className="grid gap-4 lg:grid-cols-2">
                    <section
                        aria-labelledby="seo-exposure-title"
                        className="rounded-xl border border-line bg-surface-elevated p-4 sm:p-5">
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                                <h3 id="seo-exposure-title" className="text-sm font-semibold text-content">
                                    {t({
                                        id: 'settings.seo_aeo.seo.title',
                                        message: 'SEO · Search engines'
                                    })}
                                </h3>
                                <p className="mt-2 text-sm leading-relaxed text-content-secondary">
                                    {seoEnabled
                                        ? t({
                                            id: 'settings.seo_aeo.seo.enabled_description',
                                            message: 'Allows pages to be indexed and advertises the sitemap in robots.txt.'
                                        })
                                        : t({
                                            id: 'settings.seo_aeo.seo.disabled_description',
                                            message: 'Hides the sitemap notice and adds noindex, nofollow to pages.'
                                        })}
                                </p>
                            </div>
                            <Toggle
                                checked={seoEnabled}
                                disabled={seoMutation.isPending}
                                onCheckedChange={handleSeoChange}
                                aria-label={t({
                                    id: 'settings.seo_aeo.seo.enable',
                                    message: 'Enable SEO visibility for search engines'
                                })}
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
                                    {t({
                                        id: 'settings.seo_aeo.aeo.title',
                                        message: 'AEO · AI agents'
                                    })}
                                </h3>
                                <p className="mt-2 text-sm leading-relaxed text-content-secondary">
                                    {aeoEnabled
                                        ? t({
                                            id: 'settings.seo_aeo.aeo.enabled_description',
                                            message: 'Publishes llms.txt and Markdown endpoints with discovery signals.'
                                        })
                                        : t({
                                            id: 'settings.seo_aeo.aeo.disabled_description',
                                            message: 'Returns 404 for AI-specific endpoints and removes discovery signals.'
                                        })}
                                </p>
                            </div>
                            <Toggle
                                checked={aeoEnabled}
                                disabled={aeoMutation.isPending}
                                onCheckedChange={handleAeoChange}
                                aria-label={t({
                                    id: 'settings.seo_aeo.aeo.enable',
                                    message: 'Enable AEO visibility for AI agents'
                                })}
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
                        <span className="block text-base font-semibold text-content">
                            {t({
                                id: 'settings.seo_aeo.robots.advanced_title',
                                message: 'Advanced robots.txt settings'
                            })}
                        </span>
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
                            <h3 id="robots-template-title" className="text-sm font-semibold text-content">
                                {t({
                                    id: 'settings.seo_aeo.robots.quick_add',
                                    message: 'Quick-add rules'
                                })}
                            </h3>
                            <div className="grid gap-2 sm:grid-cols-2">
                                {robotsRuleTemplates.map((template) => (
                                    <button
                                        key={template.snippet}
                                        type="button"
                                        onClick={() => handleAppendRobotsSnippet(template.snippet)}
                                        className="min-h-11 rounded-lg border border-line bg-surface-elevated px-3 py-2 text-left transition-colors hover:border-line-strong hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-strong motion-reduce:transition-none">
                                        <span className="block text-xs font-semibold text-content">
                                            {i18n._(template.title)}
                                        </span>
                                        <code className="mt-1 block whitespace-pre-wrap break-all font-mono text-xs text-content-secondary">
                                            {template.snippet}
                                        </code>
                                    </button>
                                ))}
                            </div>
                        </section>

                        <section className="space-y-2" aria-labelledby="robots-editor-title">
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                <h3 id="robots-editor-title" className="text-sm font-semibold text-content">
                                    {t({
                                        id: 'settings.seo_aeo.robots.editor_title',
                                        message: 'Edit custom rules'
                                    })}
                                </h3>
                                <span className="text-xs text-content-secondary">
                                    {t({
                                        id: 'settings.seo_aeo.robots.editor_help',
                                        message: 'Appended exactly as written after the generated defaults.'
                                    })}
                                </span>
                            </div>
                            <CodeEditor
                                ariaLabel={t({
                                    id: 'settings.seo_aeo.robots.editor_label',
                                    message: 'Custom robots.txt rules'
                                })}
                                language="plaintext"
                                value={robotsTxtExtraRules}
                                onChange={handleRobotsRulesChange}
                                height="260px"
                            />
                        </section>

                        <details className="group/preview rounded-xl border border-line bg-surface-elevated">
                            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-line-strong [&::-webkit-details-marker]:hidden">
                                <span className="min-w-0 flex-1 text-sm font-semibold text-content">
                                    {t({
                                        id: 'settings.seo_aeo.robots.preview_title',
                                        message: 'Full robots.txt preview'
                                    })}
                                </span>
                                <span className="text-xs text-content-secondary">
                                    {normalizedRobotsTxtExtraRules
                                        ? t({
                                            id: 'settings.seo_aeo.robots.preview.custom_rules',
                                            message: 'Includes custom rules'
                                        })
                                        : t({
                                            id: 'settings.seo_aeo.robots.preview.default_only',
                                            message: 'Default policy only'
                                        })}
                                </span>
                                <ChevronDown
                                    aria-hidden="true"
                                    className="h-4 w-4 shrink-0 text-content-hint transition-transform group-open/preview:rotate-180 motion-reduce:transition-none"
                                />
                            </summary>
                            <div className="border-t border-line p-4">
                                <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-surface-subtle p-4 font-mono text-xs leading-relaxed text-content-secondary">
                                    {robotsTxtPreview || t({
                                        id: 'settings.seo_aeo.robots.preview.loading',
                                        message: 'Loading preview...'
                                    })}
                                </pre>
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
                                {t({
                                    id: 'settings.seo_aeo.robots.clear',
                                    message: 'Clear custom rules'
                                })}
                            </Button>
                            <Button
                                density="compact"
                                variant="primary"
                                size="md"
                                isLoading={robotsMutation.isPending}
                                onClick={handleRobotsSave}
                                leftIcon={!robotsMutation.isPending ? <Save aria-hidden="true" className="h-4 w-4" /> : undefined}>
                                {robotsMutation.isPending
                                    ? t({
                                        id: 'common.saving_ellipsis',
                                        message: 'Saving...'
                                    })
                                    : t({
                                        id: 'settings.seo_aeo.robots.save',
                                        message: 'Save robots.txt'
                                    })}
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
                        <span className="block text-base font-semibold text-content">
                            {t({
                                id: 'settings.seo_aeo.surfaces.title',
                                message: 'Public surfaces controlled by SEO and AEO'
                            })}
                        </span>
                        <span className="mt-1 block text-sm text-content-secondary">
                            {t({
                                id: 'settings.seo_aeo.surfaces.summary',
                                message: '4 SEO surfaces · 4 AEO surfaces'
                            })}
                        </span>
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
                                    <div key={item.path} className="flex gap-4 p-4">
                                        <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-content-secondary">
                                            <ItemIcon aria-hidden="true" className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                                                <h4 className="text-sm font-semibold text-content">
                                                    {i18n._(item.name)}
                                                </h4>
                                                <code className="break-all rounded-md bg-surface-subtle px-2 py-1 text-xs text-content-secondary">
                                                    {item.path}
                                                </code>
                                            </div>
                                            <p className="mt-2 text-sm leading-relaxed text-content-secondary">
                                                {i18n._(item.description)}
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
                                    <div key={item.path} className="flex gap-4 p-4">
                                        <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-content-secondary">
                                            <ItemIcon aria-hidden="true" className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                                                <h4 className="text-sm font-semibold text-content">
                                                    {i18n._(item.name)}
                                                </h4>
                                                <code className="break-all rounded-md bg-surface-subtle px-2 py-1 text-xs text-content-secondary">
                                                    {item.path}
                                                </code>
                                            </div>
                                            <p className="mt-2 text-sm leading-relaxed text-content-secondary">
                                                {i18n._(item.description)}
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
