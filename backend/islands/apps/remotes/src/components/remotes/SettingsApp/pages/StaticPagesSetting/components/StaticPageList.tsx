import {
    TITLE,
    SUBTITLE,
    Dropdown
} from '~/components/shared';
import { SettingsListItem } from '../../../components';
import type { StaticPageData } from '~/lib/api/settings';

interface StaticPageListProps {
    pages: StaticPageData[];
    onView: (page: StaticPageData) => void;
    onEdit: (id: number) => void;
    onDelete: (id: number) => void;
}

export const StaticPageList = ({ pages, onView, onEdit, onDelete }: StaticPageListProps) => {
    return (
        <div className="space-y-3">
            {pages.map((page) => (
                <SettingsListItem
                    key={page.id}
                    onClick={() => onView(page)}
                    actions={
                        <Dropdown
                            items={[
                                {
                                    label: '편집',
                                    icon: 'fas fa-pen',
                                    onClick: () => onEdit(page.id)
                                },
                                {
                                    label: '삭제',
                                    icon: 'fas fa-trash',
                                    onClick: () => onDelete(page.id),
                                    variant: 'danger'
                                }
                            ]}
                        />
                    }>
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className={`${TITLE} mb-0`}>
                                {page.title}
                            </h3>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${page.isPublished ? 'bg-action text-content-inverted border-line-strong' : 'bg-surface-subtle text-content-secondary border-line-light'}`}>
                                {page.isPublished ? '공개' : '비공개'}
                            </span>
                            {page.showInFooter && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border bg-surface-subtle text-content border-line">
                                    푸터
                                </span>
                            )}
                        </div>
                        <p className={SUBTITLE}>/static/{page.slug}</p>
                    </div>
                </SettingsListItem>
            ))}
        </div>
    );
};
