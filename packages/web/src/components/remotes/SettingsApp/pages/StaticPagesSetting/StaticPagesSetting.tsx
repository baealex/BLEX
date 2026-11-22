import { toast } from '~/utils/toast';
import { Trans, useLingui } from '@lingui/react/macro';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { FileText } from '@blex/ui/icons';
import { useConfirm } from '~/hooks/useConfirm';
import {
    SettingsEmptyState,
    SettingsHeader
} from '../../components';
import {
    getStaticPages,
    deleteStaticPage,
    type StaticPageData
} from '~/lib/api/settings';
import { StaticPageList } from './components/StaticPageList';

const StaticPagesSetting = () => {
    const { i18n, t } = useLingui();
    const { confirm } = useConfirm();
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const { data: pagesData } = useSuspenseQuery({
        queryKey: ['static-pages'],
        queryFn: async () => {
            const { data } = await getStaticPages();
            if (data.status === 'DONE') {
                return data.body.pages;
            }
            throw new Error(t({
                id: 'settings.static_pages.load_failed',
                message: 'Could not load static pages.'
            }));
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id: number) => deleteStaticPage(id),
        onSuccess: () => {
            toast.success(t({
                id: 'settings.static_pages.delete.success',
                message: 'Static page deleted.'
            }));
            queryClient.invalidateQueries({ queryKey: ['static-pages'] });
        },
        onError: () => {
            toast.error(t({
                id: 'settings.static_pages.delete.failed',
                message: 'Could not delete the static page.'
            }));
        }
    });

    const handleDelete = async (id: number) => {
        const currentPage = pagesData?.find((page) => page.id === id);
        const confirmed = await confirm({
            title: t({
                id: 'settings.static_pages.delete.title',
                message: 'Delete static page'
            }),
            message: currentPage
                ? i18n._({
                    id: 'settings.static_pages.delete.confirm_named',
                    message: 'Delete “{title}”?\n\nThis action cannot be undone.',
                    values: { title: currentPage.title }
                })
                : t({
                    id: 'settings.static_pages.delete.confirm',
                    message: 'Delete this page?\n\nThis action cannot be undone.'
                }),
            confirmText: t({
                id: 'common.delete',
                message: 'Delete'
            })
        });

        if (confirmed) {
            deleteMutation.mutate(id);
        }
    };

    const handleEdit = (id: number) => {
        navigate({
            to: '/static-pages/edit/$pageId',
            params: { pageId: String(id) }
        });
    };

    const handleView = (page: StaticPageData) => {
        if (!page.isPublished) {
            toast.info(t({
                id: 'settings.static_pages.view.unpublished',
                message: 'Private pages cannot be opened. Publish the page and try again.'
            }));
            return;
        }

        window.location.assign(`/static/${page.slug}`);
    };

    const createAction = (
        <Link
            to="/static-pages/create"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-transparent bg-action px-3 py-1.5 text-xs font-semibold text-content-inverted transition-all duration-150 hover:bg-action-hover focus:outline-none focus:ring-4 focus:ring-action/20 focus:ring-offset-1 active:scale-95 [@media(pointer:fine)]:min-h-9">
            <Trans id="settings.static_pages.create">Add page</Trans>
        </Link>
    );

    return (
        <div className="space-y-8">
            <SettingsHeader
                title={i18n._({
                    id: 'settings.static_pages.title_count',
                    message: 'Static pages ({count})',
                    values: { count: pagesData?.length || 0 }
                })}
                description={i18n._({
                    id: 'settings.static_pages.description',
                    message: 'Published pages are available at /static/{slug}.',
                    values: { slug: '{slug}' }
                })}
                actionPosition="right"
                action={pagesData && pagesData.length > 0 ? createAction : undefined}
            />

            {pagesData && pagesData.length > 0 ? (
                <StaticPageList
                    pages={pagesData}
                    onView={handleView}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                />
            ) : (
                <SettingsEmptyState
                    icon={<FileText aria-hidden="true" className="h-4 w-4" />}
                    title={t({
                        id: 'settings.static_pages.empty',
                        message: 'No static pages yet'
                    })}
                    action={createAction}
                />
            )}
        </div>
    );
};

export default StaticPagesSetting;
