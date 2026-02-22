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
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${page.isPublished ? 'bg-gray-900 text-white border-gray-900' : 'bg-gray-50 text-gray-500 border-gray-100'}`}>
                                {page.isPublished ? '공개' : '비공개'}
                            </span>
                            {page.showInFooter && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border bg-gray-100 text-gray-700 border-gray-200">
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
