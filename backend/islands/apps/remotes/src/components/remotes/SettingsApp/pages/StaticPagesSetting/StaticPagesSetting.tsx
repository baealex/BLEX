import { toast } from '~/utils/toast';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useConfirm } from '~/hooks/useConfirm';
import { SettingsHeader } from '../../components';
import { Button } from '~/components/shared';
import {
    getStaticPages,
    deleteStaticPage
} from '~/lib/api/settings';
import { StaticPageList } from './components/StaticPageList';

const StaticPagesSetting = () => {
    const { confirm } = useConfirm();
    const queryClient = useQueryClient();

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
        const confirmed = await confirm({
            title: '정적 페이지 삭제',
            message: '정말로 이 페이지를 삭제하시겠습니까?',
            confirmText: '삭제'
        });

        if (confirmed) {
            deleteMutation.mutate(id);
        }
    };

    return (
        <div className="space-y-8">
            <SettingsHeader
                title={`정적 페이지 (${pagesData?.length || 0})`}
                description="사이트의 정적 페이지를 관리합니다. 이용약관, 개인정보처리방침 등을 만들 수 있습니다."
                action={
                    <Link to="/static-pages/create">
                        <Button
                            variant="primary"
                            size="md"
                            className="shadow-sm"
                            leftIcon={<i className="fas fa-plus" />}>
                            새 페이지 추가
                        </Button>
                    </Link>
                }
            />

            {pagesData && pagesData.length > 0 ? (
                <StaticPageList
                    pages={pagesData}
                    onDelete={handleDelete}
                />
            ) : (
                <div className="py-16 text-center border border-dashed border-gray-200 rounded-2xl">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-50 mb-4">
                        <i className="fas fa-file-lines text-2xl text-gray-300" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">등록된 정적 페이지가 없습니다</h3>
                    <p className="text-gray-500 text-sm mb-6">첫 번째 정적 페이지를 만들어보세요.</p>
                    <Link to="/static-pages/create">
                        <Button variant="secondary" size="md">
                            페이지 생성하기
                        </Button>
                    </Link>
                </div>
            )}
        </div>
    );
};

export default StaticPagesSetting;
