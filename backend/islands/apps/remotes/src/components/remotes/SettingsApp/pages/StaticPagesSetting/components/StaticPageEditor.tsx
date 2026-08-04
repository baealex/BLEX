import { useState, useRef } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { Link, useNavigate, useBlocker } from '@tanstack/react-router';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { toast } from '~/utils/toast';
import { useConfirm } from '~/hooks/useConfirm';
import {
    Button,
    Input,
    DIM_OVERLAY_DEFAULT,
    ENTRANCE_DURATION
} from '~/components/shared';
import { CodeEditor } from '~/components/CodeEditor';
import { Dialog } from '@blex/ui/dialog';
import { FloatingBottomBar } from '@blex/ui/floating-bottom-bar';
import { IconButton } from '@blex/ui/icon-button';
import { Toggle } from '@blex/ui/toggle';
import {
    ArrowLeft,
    ChevronDown,
    ExternalLink,
    Search,
    Send,
    Settings2,
    SlidersHorizontal,
    X
} from '@blex/ui/icons';
import { cx } from '~/lib/classnames';
import {
    getStaticPage,
    createStaticPage,
    updateStaticPage,
    deleteStaticPage,
    type StaticPageCreateData
} from '~/lib/api/settings';

const toSlug = (text: string, trim = false) => {
    let result = text
        .toLowerCase()
        .replace(/[^a-z0-9가-힣\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
    if (trim) {
        result = result.replace(/^-|-$/g, '');
    }
    return result;
};

interface StaticPageEditorProps {
    pageId?: number;
}

const StaticPageEditor = ({ pageId }: StaticPageEditorProps) => {
    const { i18n, t } = useLingui();
    const isEditMode = pageId !== undefined;
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { confirm } = useConfirm();
    const isDirtyRef = useRef(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const { data: page } = useSuspenseQuery({
        queryKey: ['static-page', pageId],
        queryFn: async () => {
            if (!pageId) return null;
            const { data } = await getStaticPage(pageId);
            if (data.status === 'DONE') {
                return data.body;
            }
            throw new Error(t({
                id: 'settings.static_pages.editor.load_failed',
                message: 'Could not load the static page.'
            }));
        }
    });

    const [title, setTitle] = useState(page?.title ?? '');
    const [slug, setSlug] = useState(page?.slug ?? '');
    const [slugManuallyEdited, setSlugManuallyEdited] = useState(!!page);
    const [content, setContent] = useState(page?.content ?? '');
    const [metaDescription, setMetaDescription] = useState(page?.metaDescription ?? '');
    const [isPublished, setIsPublished] = useState(page?.isPublished ?? true);
    const [showInFooter, setShowInFooter] = useState(page?.showInFooter ?? false);
    const [order, setOrder] = useState(page?.order ?? 0);
    const [activePanel, setActivePanel] = useState<'code' | 'preview'>('code');
    const pageUrlPath = `/static/${slug || 'slug'}`;

    const markDirty = () => {
        isDirtyRef.current = true;
    };

    useBlocker({
        shouldBlockFn: async () => {
            if (!isDirtyRef.current) return false;
            const confirmed = await confirm({
                title: t({
                    id: 'settings.static_pages.editor.unsaved.title',
                    message: 'Unsaved changes'
                }),
                message: t({
                    id: 'settings.static_pages.editor.unsaved.message',
                    message: 'Your changes have not been saved. Leave this page?'
                }),
                confirmText: t({
                    id: 'settings.static_pages.editor.unsaved.leave',
                    message: 'Leave'
                }),
                variant: 'danger'
            });
            return !confirmed;
        },
        enableBeforeUnload: () => isDirtyRef.current
    });

    const handleTitleChange = (value: string) => {
        setTitle(value);
        markDirty();
        if (!slugManuallyEdited) {
            setSlug(toSlug(value));
        }
    };

    const handleSlugChange = (value: string) => {
        setSlugManuallyEdited(true);
        setSlug(toSlug(value));
        markDirty();
    };

    const handleContentChange = (value: string) => {
        setContent(value);
        markDirty();
    };

    const handlePublishedChange = (checked: boolean) => {
        setIsPublished(checked);
        markDirty();
    };

    const handleShowInFooterChange = (checked: boolean) => {
        setShowInFooter(checked);
        markDirty();
    };

    const createMutation = useMutation({
        mutationFn: (pageData: StaticPageCreateData) => createStaticPage(pageData),
        onSuccess: ({ data }) => {
            if (data.status === 'ERROR') {
                toast.error(data.errorMessage || t({
                    id: 'settings.static_pages.editor.create_failed',
                    message: 'Could not create the static page.'
                }));
                return;
            }
            isDirtyRef.current = false;
            toast.success(t({
                id: 'settings.static_pages.editor.create_success',
                message: 'Static page created.'
            }));
            queryClient.invalidateQueries({ queryKey: ['static-pages'] });
            navigate({ to: '/static-pages' });
        },
        onError: () => {
            toast.error(t({
                id: 'settings.static_pages.editor.create_failed',
                message: 'Could not create the static page.'
            }));
        }
    });

    const updateMutation = useMutation({
        mutationFn: (pageData: StaticPageCreateData) => {
            if (!pageId) throw new Error('pageId is required');
            return updateStaticPage(pageId, pageData);
        },
        onSuccess: ({ data }) => {
            if (data.status === 'ERROR') {
                toast.error(data.errorMessage || t({
                    id: 'settings.static_pages.editor.update_failed',
                    message: 'Could not update the static page.'
                }));
                return;
            }
            isDirtyRef.current = false;
            toast.success(t({
                id: 'settings.static_pages.editor.update_success',
                message: 'Static page updated.'
            }));
            queryClient.invalidateQueries({ queryKey: ['static-pages'] });
            navigate({ to: '/static-pages' });
        },
        onError: () => {
            toast.error(t({
                id: 'settings.static_pages.editor.update_failed',
                message: 'Could not update the static page.'
            }));
        }
    });

    const deleteMutation = useMutation({
        mutationFn: () => {
            if (!pageId) throw new Error('pageId is required');
            return deleteStaticPage(pageId);
        },
        onSuccess: ({ data }) => {
            if (data.status === 'ERROR') {
                toast.error(data.errorMessage || t({
                    id: 'settings.static_pages.delete.failed',
                    message: 'Could not delete the static page.'
                }));
                return;
            }
            isDirtyRef.current = false;
            toast.success(t({
                id: 'settings.static_pages.delete.success',
                message: 'Static page deleted.'
            }));
            queryClient.invalidateQueries({ queryKey: ['static-pages'] });
            navigate({ to: '/static-pages' });
        },
        onError: () => {
            toast.error(t({
                id: 'settings.static_pages.delete.failed',
                message: 'Could not delete the static page.'
            }));
        }
    });

    const isLoading = createMutation.isPending || updateMutation.isPending;

    const handleSubmit = () => {
        if (!title.trim()) {
            toast.error(t({
                id: 'settings.static_pages.editor.validation.title',
                message: 'Enter a page name.'
            }));
            return;
        }
        if (!slug.trim()) {
            toast.error(t({
                id: 'settings.static_pages.editor.validation.slug',
                message: 'Enter a URL slug.'
            }));
            return;
        }

        const pageData: StaticPageCreateData = {
            title: title.trim(),
            slug: toSlug(slug, true),
            content,
            meta_description: metaDescription.trim(),
            is_published: isPublished,
            show_in_footer: showInFooter,
            order
        };

        if (isEditMode) {
            updateMutation.mutate(pageData);
        } else {
            createMutation.mutate(pageData);
        }
    };

    const handleDelete = async () => {
        const confirmed = await confirm({
            title: t({
                id: 'settings.static_pages.delete.title',
                message: 'Delete static page'
            }),
            message: i18n._({
                id: 'settings.static_pages.delete.confirm_named',
                message: 'Delete “{title}”?\n\nThis action cannot be undone.',
                values: { title }
            }),
            confirmText: t({
                id: 'common.delete',
                message: 'Delete'
            }),
            variant: 'danger'
        });

        if (!confirmed) {
            return;
        }

        deleteMutation.mutate();
    };

    return (
        <div className="min-h-screen bg-surface pb-16">
            <h1 className="sr-only">
                {isEditMode
                    ? <Trans id="settings.static_pages.editor.edit_title">Edit static page</Trans>
                    : <Trans id="settings.static_pages.editor.create_title">Create static page</Trans>}
            </h1>
            {/* Top bar */}
            <div className="sticky top-0 z-10 bg-surface border-b border-line">
                <div className="max-w-7xl mx-auto px-4 md:px-6 flex items-center justify-between h-14">
                    <Link
                        to="/static-pages"
                        className="flex min-h-11 items-center gap-2 text-sm text-content-secondary transition-colors hover:text-content [@media(pointer:fine)]:min-h-9">
                        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                        <span><Trans id="settings.static_pages.editor.back_to_list">Back to list</Trans></span>
                    </Link>
                    {isEditMode && slug ? (
                        <a
                            href={pageUrlPath}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex min-h-11 items-center gap-1.5 text-sm text-content-secondary transition-colors hover:text-content [@media(pointer:fine)]:min-h-9">
                            <span>{pageUrlPath}</span>
                            <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                        </a>
                    ) : (
                        <div />
                    )}
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 md:px-6 pb-6 pt-8">
                <div className="rounded-2xl border border-line bg-surface p-4 md:p-5">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Input
                                density="compact"
                                label={t({
                                    id: 'settings.static_pages.editor.name.label',
                                    message: 'Page name'
                                })}
                                value={title}
                                onChange={(e) => handleTitleChange(e.target.value)}
                                placeholder={t({
                                    id: 'settings.static_pages.editor.name.placeholder',
                                    message: 'e.g. Terms of Service, Privacy Policy'
                                })}
                            />
                            <p className="text-xs text-content-hint">
                                <Trans id="settings.static_pages.editor.name.help">
                                    Shown in the browser tab and page list.
                                </Trans>
                            </p>
                        </div>

                        <details className="group border-t border-line-light pt-4">
                            <summary className="flex min-h-11 cursor-pointer list-none items-center text-sm font-medium text-content-secondary transition-colors hover:text-content [@media(pointer:fine)]:min-h-9">
                                <Trans id="settings.static_pages.editor.url.customize">Customize URL</Trans>
                                <ChevronDown
                                    aria-hidden="true"
                                    className="ml-2 inline h-3.5 w-3.5 transition-transform group-open:rotate-180"
                                />
                            </summary>
                            <div className="mt-3">
                                <Input
                                    density="compact"
                                    label={t({
                                        id: 'settings.static_pages.editor.slug.label',
                                        message: 'URL slug'
                                    })}
                                    value={slug}
                                    onChange={(e) => handleSlugChange(e.target.value)}
                                    placeholder="page-url-slug"
                                />
                            </div>
                        </details>

                        <p className="break-all text-xs text-content-hint">
                            {pageUrlPath}
                            {!isEditMode && !slugManuallyEdited && (
                                <>
                                    {' · '}
                                    <Trans id="settings.static_pages.editor.slug.auto">
                                        Generated automatically from the page name.
                                    </Trans>
                                </>
                            )}
                        </p>
                    </div>
                </div>
            </div>

            {/* Editor*/}
            <div className="max-w-7xl mx-auto px-4 md:px-6 pb-6">
                <div className="space-y-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <p className="text-sm font-semibold text-content">
                            <Trans id="settings.static_pages.editor.content">Content</Trans>
                        </p>
                        <div className="inline-flex rounded-lg border border-line bg-surface p-1">
                            <button
                                type="button"
                                aria-pressed={activePanel === 'code'}
                                onClick={() => setActivePanel('code')}
                                className={`inline-flex min-h-11 items-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors [@media(pointer:fine)]:min-h-8 ${
                                    activePanel === 'code'
                                        ? 'bg-surface-subtle text-content'
                                        : 'text-content-secondary hover:text-content'
                                }`}>
                                HTML
                            </button>
                            <button
                                type="button"
                                aria-pressed={activePanel === 'preview'}
                                onClick={() => setActivePanel('preview')}
                                className={`inline-flex min-h-11 items-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors [@media(pointer:fine)]:min-h-8 ${
                                    activePanel === 'preview'
                                        ? 'bg-surface-subtle text-content'
                                        : 'text-content-secondary hover:text-content'
                                }`}>
                                <Trans id="common.preview">Preview</Trans>
                            </button>
                        </div>
                    </div>

                    {activePanel === 'code' ? (
                        <CodeEditor
                            ariaLabel={t({
                                id: 'settings.static_pages.editor.html.aria',
                                message: 'Static page HTML'
                            })}
                            language="html"
                            value={content}
                            onChange={handleContentChange}
                            height="560px"
                        />
                    ) : (
                        <div className="h-[560px] overflow-auto rounded-lg border border-line bg-surface-elevated">
                            <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
                                <div className="mb-4 rounded-lg border border-line-light bg-surface-subtle px-3 py-2 text-xs text-content-secondary">
                                    <Trans id="settings.static_pages.editor.preview.container_note">
                                        This spacing and width match the default container on the published page.
                                    </Trans>
                                </div>
                                {content.trim() ? (
                                    <div
                                        className="break-words"
                                        dangerouslySetInnerHTML={{ __html: content }}
                                    />
                                ) : (
                                    <div className="flex min-h-[360px] items-center justify-center text-sm text-content-hint">
                                        <Trans id="settings.static_pages.editor.preview.empty">
                                            Enter HTML to see a preview.
                                        </Trans>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <FloatingBottomBar>
                {isEditMode && (
                    <>
                        <Button
                            density="compact"
                            type="button"
                            variant="ghost"
                            size="md"
                            isLoading={deleteMutation.isPending}
                            disabled={isLoading}
                            onClick={handleDelete}
                            className="!rounded-full !text-danger hover:!text-danger hover:!bg-danger-surface">
                            <Trans id="common.delete">Delete</Trans>
                        </Button>
                        <div className="w-px h-8 bg-line/60 mx-1" />
                    </>
                )}

                <IconButton
                    onClick={() => setIsSettingsOpen(true)}
                    size="sm"
                    rounded="full"
                    className="[@media(pointer:fine)]:h-9! [@media(pointer:fine)]:w-9!"
                    aria-label={t({
                        id: 'settings.static_pages.editor.settings',
                        message: 'Page settings'
                    })}
                    title={t({
                        id: 'settings.static_pages.editor.settings',
                        message: 'Page settings'
                    })}>
                    <SlidersHorizontal className="w-5 h-5" />
                </IconButton>

                <div className="w-px h-8 bg-line/60 mx-1" />

                <Button
                    density="compact"
                    onClick={handleSubmit}
                    disabled={isLoading || deleteMutation.isPending}
                    variant="primary"
                    className="!rounded-full"
                    leftIcon={!isLoading ? <Send className="w-4 h-4" /> : undefined}
                    isLoading={isLoading}>
                    {isLoading
                        ? <Trans id="common.saving">Saving</Trans>
                        : isEditMode
                            ? <Trans id="common.update">Update</Trans>
                            : <Trans id="common.create">Create</Trans>}
                </Button>
            </FloatingBottomBar>

            {/* Settings Drawer */}
            <Dialog.Root open={isSettingsOpen} onOpenChange={(open) => !open && setIsSettingsOpen(false)}>
                <Dialog.Portal>
                    <Dialog.Overlay className={`fixed inset-0 ${DIM_OVERLAY_DEFAULT} z-40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0`} />
                    <Dialog.Content
                        className={cx(
                            'fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-surface shadow-2xl flex flex-col focus:outline-none',
                            'data-[state=open]:animate-in data-[state=closed]:animate-out',
                            'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
                            `${ENTRANCE_DURATION} ease-in-out`
                        )}>
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-5 border-b border-line">
                            <div className="flex items-center gap-3">
                                <SlidersHorizontal className="w-5 h-5 text-content-hint" />
                                <Dialog.Title className="text-lg font-semibold text-content">
                                    <Trans id="settings.static_pages.editor.settings">Page settings</Trans>
                                </Dialog.Title>
                            </div>
                            <Dialog.Close asChild>
                                <IconButton
                                    size="sm"
                                    className="[@media(pointer:fine)]:h-9! [@media(pointer:fine)]:w-9!"
                                    aria-label={t({
                                        id: 'common.close',
                                        message: 'Close'
                                    })}>
                                    <X className="w-5 h-5" />
                                </IconButton>
                            </Dialog.Close>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto px-6 py-6">
                            <div className="space-y-8">
                                {/* Publish Section */}
                                <div>
                                    <h3 className="text-sm font-semibold text-content mb-4 flex items-center gap-2">
                                        <Settings2 className="w-4 h-4" />
                                        <Trans id="settings.static_pages.editor.publish_settings">
                                            Publishing
                                        </Trans>
                                    </h3>
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between gap-4 py-3">
                                            <div className="min-w-0 flex-1 text-sm font-medium text-content">
                                                <Trans id="settings.static_pages.editor.published">Published</Trans>
                                            </div>
                                            <Toggle
                                                checked={isPublished}
                                                onCheckedChange={handlePublishedChange}
                                                aria-label={t({
                                                    id: 'settings.static_pages.editor.published',
                                                    message: 'Published'
                                                })}
                                            />
                                        </div>

                                        <div className="flex items-center justify-between gap-4 py-3">
                                            <div className="min-w-0 flex-1 text-sm font-medium text-content">
                                                <Trans id="settings.static_pages.editor.show_in_footer">
                                                    Show in footer
                                                </Trans>
                                            </div>
                                            <Toggle
                                                checked={showInFooter}
                                                onCheckedChange={handleShowInFooterChange}
                                                aria-label={t({
                                                    id: 'settings.static_pages.editor.show_in_footer',
                                                    message: 'Show in footer'
                                                })}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="border-t border-line" />

                                {/* SEO Section */}
                                <div>
                                    <h3 className="text-sm font-semibold text-content mb-4 flex items-center gap-2">
                                        <Search className="w-4 h-4" />
                                        <Trans id="settings.static_pages.editor.search_appearance">
                                            Search appearance
                                        </Trans>
                                    </h3>
                                    <div className="space-y-4">
                                        <div>
                                            <Input
                                                density="compact"
                                                label={t({
                                                    id: 'settings.static_pages.editor.meta_description.label',
                                                    message: 'Meta description'
                                                })}
                                                multiline
                                                rows={3}
                                                value={metaDescription}
                                                onChange={(e) => {
                                                    setMetaDescription(e.target.value);
                                                    markDirty();
                                                }}
                                                placeholder={t({
                                                    id: 'settings.static_pages.editor.meta_description.placeholder',
                                                    message: 'Summarize this page'
                                                })}
                                                maxLength={160}
                                            />
                                            <div className="flex items-center justify-between mt-2">
                                                <p className="text-xs text-content-hint">
                                                    <Trans id="settings.static_pages.editor.meta_description.help">
                                                        Shown in search results.
                                                    </Trans>
                                                </p>
                                                <p className={`text-xs font-medium ${metaDescription.length > 140 ? 'text-danger' : 'text-content-hint'}`}>
                                                    {metaDescription.length}/160
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="border-t border-line" />

                                {/* Page Settings */}
                                <div>
                                    <h3 className="text-sm font-semibold text-content mb-4 flex items-center gap-2">
                                        <Settings2 className="w-4 h-4" />
                                        <Trans id="settings.static_pages.editor.advanced_settings">
                                            Advanced settings
                                        </Trans>
                                    </h3>
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between py-3">
                                            <div className="flex items-center gap-3">
                                                <Settings2 className="w-4 h-4 text-content-hint" />
                                                <div>
                                                    <div className="text-sm font-medium text-content">
                                                        <Trans id="settings.static_pages.editor.order.label">Order</Trans>
                                                    </div>
                                                    <div className="text-xs text-content-secondary">
                                                        <Trans id="settings.static_pages.editor.order.help">
                                                            Display order in the footer menu
                                                        </Trans>
                                                    </div>
                                                </div>
                                            </div>
                                            <input
                                                type="number"
                                                aria-label={t({
                                                    id: 'settings.static_pages.editor.order.aria',
                                                    message: 'Footer menu display order'
                                                })}
                                                value={order}
                                                onChange={(e) => {
                                                    setOrder(parseInt(e.target.value) || 0);
                                                    markDirty();
                                                }}
                                                className="w-16 text-right text-sm border border-line rounded-lg px-2 py-1.5 outline-none focus:border-line-strong"
                                            />
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-line bg-surface-subtle">
                            <Button
                                density="compact"
                                type="button"
                                onClick={() => setIsSettingsOpen(false)}
                                variant="primary"
                                size="md"
                                fullWidth>
                                <Trans id="common.done">Done</Trans>
                            </Button>
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>
        </div>
    );
};

export default StaticPageEditor;
