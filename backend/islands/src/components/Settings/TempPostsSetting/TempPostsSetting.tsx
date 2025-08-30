import { useEffect } from 'react';
import { http, type Response } from '~/modules/http.module';
import { notification } from '@baejino/ui';
import { useFetch } from '~/hooks/use-fetch';

interface TempPost {
    token: string;
    title: string;
    createdDate: string;
}

interface TempPostsData {
    temps: TempPost[];
}

const TempPostsSetting = () => {
    const { data: tempPosts, isLoading, isError, refetch } = useFetch({
        queryKey: ['temp-posts'],
        queryFn: async () => {
            const { data } = await http<Response<TempPostsData>>('v1/temp-posts', { method: 'GET' });
            if (data.status === 'DONE') {
                return data.body.temps;
            }
            throw new Error('임시저장 포스트 목록을 불러오는데 실패했습니다.');
        }
    });

    useEffect(() => {
        if (isError) {
            notification('임시저장 포스트 목록을 불러오는데 실패했습니다.', { type: 'error' });
        }
    }, [isError]);

    const handleTempPostDelete = async (token: string) => {
        if (!confirm('정말 이 임시저장 포스트를 삭제할까요?')) return;

        try {
            const { data } = await http(`v1/temp-posts/${token}`, { method: 'DELETE' });

            if (data.status === 'DONE') {
                notification('임시저장 포스트가 삭제되었습니다.', { type: 'success' });
                refetch();
            } else {
                throw new Error('Failed to delete temp post');
            }
        } catch {
            notification('임시저장 포스트 삭제에 실패했습니다.', { type: 'error' });
        }
    };

    return (
        <div className="p-4 sm:p-6 bg-white shadow-sm border border-slate-200/60 rounded-xl">
            {/* 헤더 섹션 */}
            <div className="mb-6">
                <div className="border-b border-slate-200 pb-4">
                    <h2 className="text-xl font-bold text-slate-900 mb-2">
                        임시저장 포스트 관리
                    </h2>
                    <p className="text-slate-600 text-sm">총 {tempPosts?.length || 0}개의 임시저장 포스트</p>
                </div>
            </div>

            <div className="mb-6">
                {isLoading ? (
                    <div className="animate-pulse space-y-4">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="bg-white border border-slate-200/60 rounded-xl p-4 sm:p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex-1">
                                        <div className="h-6 bg-slate-200 rounded w-3/4 mb-3" />
                                        <div className="flex items-center space-x-4">
                                            <div className="h-4 bg-slate-200 rounded w-24" />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-10 h-10 bg-slate-200 rounded-lg" />
                                        <div className="w-10 h-10 bg-slate-200 rounded-lg" />
                                        <div className="w-10 h-10 bg-slate-200 rounded-lg" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (!tempPosts || tempPosts.length === 0) ? (
                    <div className="text-center py-12">
                        <div className="w-16 h-16 mx-auto bg-slate-100 rounded-full flex items-center justify-center mb-4">
                            <i className="fas fa-save text-slate-400 text-2xl" />
                        </div>
                        <h3 className="text-lg font-medium text-slate-900 mb-2">임시저장 포스트가 없습니다</h3>
                        <p className="text-slate-500 mb-4">포스트 작성 중 임시저장하면 여기에 표시됩니다.</p>
                        <a
                            href="/write"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm transition-colors duration-200">
                            <i className="fas fa-plus text-sm" />
                            첫 포스트 작성하기
                        </a>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {tempPosts.map((tempPost) => (
                            <div key={tempPost.token} className="bg-white border border-slate-200 rounded-lg p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-lg font-medium text-slate-900 truncate mb-2">
                                            {tempPost.title || '제목 없음'}
                                        </h3>
                                        <div className="flex items-center gap-4 text-sm text-slate-500">
                                            <span className="flex items-center">
                                                <i className="fas fa-clock mr-1" />
                                                {tempPost.createdDate}
                                            </span>
                                            <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs">
                                                임시저장
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 ml-4">
                                        <a
                                            href={`/write?tempToken=${tempPost.token}`}
                                            className="px-3 py-1 text-sm bg-blue-100 text-blue-700 hover:bg-blue-200 rounded transition-colors"
                                            title="임시저장 포스트 편집">
                                            편집
                                        </a>
                                        <button
                                            onClick={() => handleTempPostDelete(tempPost.token)}
                                            className="px-3 py-1 text-sm bg-red-100 text-red-700 hover:bg-red-200 rounded transition-colors"
                                            title="임시저장 포스트 삭제">
                                            삭제
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TempPostsSetting;
