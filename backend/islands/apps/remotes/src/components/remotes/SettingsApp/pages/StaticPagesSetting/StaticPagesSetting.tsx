import { toast } from '~/utils/toast';
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
            throw new Error('정적 페이지 목록을 불러오는데 실패했습니다.');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id: number) => deleteStaticPage(id),
        onSuccess: () => {
            toast.success('정적 페이지가 삭제되었습니다.');
            queryClient.invalidateQueries({ queryKey: ['static-pages'] });
        },
        onError: () => {
            toast.error('정적 페이지 삭제에 실패했습니다.');
        }
    });

    const handleDelete = async (id: number) => {
        const currentPage = pagesData?.find((page) => page.id === id);
        const confirmed = await confirm({
            title: '정적 페이지 삭제',
            message: currentPage
                ? `"${currentPage.title}" 페이지를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`
                : '정말로 이 페이지를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.',
            confirmText: '삭제'
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
            toast.info('비공개 페이지는 열 수 없습니다. 공개한 뒤 다시 시도해주세요.');
            return;
        }

        window.location.assign(`/static/${page.slug}`);
    };

    const createAction = (
        <Link
            to="/static-pages/create"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-transparent bg-action px-3 py-1.5 text-xs font-semibold text-content-inverted transition-all duration-150 hover:bg-action-hover focus:outline-none focus:ring-4 focus:ring-action/20 focus:ring-offset-1 active:scale-95 [@media(pointer:fine)]:min-h-9">
            새 페이지 추가
        </Link>
    );

    return (
        <div className="space-y-8">
            <SettingsHeader
                title={`정적 페이지 (${pagesData?.length || 0})`}
                description="공개한 페이지는 /static/{slug} 주소로 제공됩니다."
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
                    title="정적 페이지가 없습니다"
                    action={createAction}
                />
            )}
        </div>
    );
};

export default StaticPagesSetting;
