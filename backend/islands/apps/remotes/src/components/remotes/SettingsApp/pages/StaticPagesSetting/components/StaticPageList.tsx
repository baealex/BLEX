import { Link } from '@tanstack/react-router';
import {
    TITLE,
    SUBTITLE,
    Button
} from '~/components/shared';
import { SettingsListItem } from '../../../components';
import type { StaticPageData } from '~/lib/api/settings';

interface StaticPageListProps {
    pages: StaticPageData[];
    onDelete: (id: number) => void;
}

export const StaticPageList = ({ pages, onDelete }: StaticPageListProps) => {
    return (
        <div className="space-y-3">
            {pages.map((page) => (
                <SettingsListItem
                    key={page.id}
                    actions={
                        <div className="flex items-center gap-1">
                            <a
                                href={`/static/${page.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}>
                                <Button variant="ghost" size="sm">
                                    <i className="fas fa-external-link-alt text-xs" />
                                    <span className="hidden sm:inline">보기</span>
                                </Button>
                            </a>
                            <Link to={`/static-pages/edit/${page.id}`}>
                                <Button variant="ghost" size="sm">
                                    <i className="fas fa-pen text-xs" />
                                    <span className="hidden sm:inline">편집</span>
                                </Button>
                            </Link>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => onDelete(page.id)}>
                                <i className="fas fa-trash text-xs" />
                            </Button>
                        </div>
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
