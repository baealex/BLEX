import { Trans, useLingui } from '@lingui/react/macro';
import { Dropdown } from '~/components/shared';
import { Pencil, Trash2 } from '@blex/ui/icons';
import { SETTINGS_LIST_META, SETTINGS_LIST_TITLE } from '~/styles/settingsStyles';
import { SettingsListItem } from '../../../components';
import type { StaticPageData } from '~/lib/api/settings';

interface StaticPageListProps {
    pages: StaticPageData[];
    onView: (page: StaticPageData) => void;
    onEdit: (id: number) => void;
    onDelete: (id: number) => void;
}

export const StaticPageList = ({ pages, onView, onEdit, onDelete }: StaticPageListProps) => {
    const { i18n, t } = useLingui();

    return (
        <div className="space-y-3">
            {pages.map((page) => (
                <SettingsListItem
                    key={page.id}
                    onClick={() => onView(page)}
                    actions={
                        <Dropdown
                            density="compact"
                            triggerAriaLabel={i18n._({
                                id: 'settings.static_pages.list.menu_label',
                                message: 'Open menu for {title}',
                                values: { title: page.title }
                            })}
                            triggerClassName="min-h-11 min-w-11 [@media(pointer:fine)]:min-h-9 [@media(pointer:fine)]:min-w-9"
                            items={[
                                {
                                    label: t({
                                        id: 'common.edit',
                                        message: 'Edit'
                                    }),
                                    icon: <Pencil aria-hidden="true" className="h-4 w-4" />,
                                    onClick: () => onEdit(page.id)
                                },
                                {
                                    label: t({
                                        id: 'common.delete',
                                        message: 'Delete'
                                    }),
                                    icon: <Trash2 aria-hidden="true" className="h-4 w-4" />,
                                    onClick: () => onDelete(page.id),
                                    variant: 'danger'
                                }
                            ]}
                        />
                    }>
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className={`${SETTINGS_LIST_TITLE} mb-0`}>
                                {page.title}
                            </h3>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${page.isPublished ? 'bg-action text-content-inverted border-line-strong' : 'bg-surface-subtle text-content-secondary border-line-light'}`}>
                                {page.isPublished
                                    ? <Trans id="settings.static_pages.status.public">Public</Trans>
                                    : <Trans id="settings.static_pages.status.private">Private</Trans>}
                            </span>
                            {page.showInFooter && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border bg-surface-subtle text-content border-line">
                                    <Trans id="settings.static_pages.status.footer">Footer</Trans>
                                </span>
                            )}
                        </div>
                        <p className={SETTINGS_LIST_META}>/static/{page.slug}</p>
                    </div>
                </SettingsListItem>
            ))}
        </div>
    );
};
