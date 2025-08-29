import { useFetch } from '~/hooks/use-fetch';
import { http } from '~/modules/http.module';

interface DashboardStatsData {
    totalPosts: number;
    totalViews: number;
    totalLikes: number;
    totalComments: number;
}

const DashboardStats = () => {
    const { data: stats, isLoading } = useFetch<DashboardStatsData>({
        queryKey: ['dashboard-stats'],
        queryFn: async () => {
            const { data: response } = await http('/v1/dashboard/stats', { method: 'GET' });
            if (response.status === 'DONE') {
                return response.body;
            }
            throw new Error('Failed to fetch dashboard stats');
        }
    });

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 animate-pulse">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 bg-slate-200 rounded-xl" />
                            <div className="w-12 h-6 bg-slate-200 rounded-full" />
                        </div>
                        <div className="space-y-2">
                            <div className="h-8 bg-slate-200 rounded w-16" />
                            <div className="h-4 bg-slate-200 rounded w-20" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="col-span-full text-center py-8 text-slate-500">
                    통계 데이터를 불러올 수 없습니다.
                </div>
            </div>
        );
    }

    const formatNumber = (num: number | undefined | null) => (num ?? 0).toLocaleString();

    const statsCards = [
        {
            key: 'posts',
            value: stats.totalPosts,
            label: '총 작성한 글',
            icon: 'fas fa-file-alt',
            bgColor: 'from-blue-500 to-blue-600',
            shadowColor: 'shadow-blue-200',
            badgeColor: 'text-blue-600 bg-blue-50',
            badgeText: '포스트'
        },
        {
            key: 'views',
            value: stats.totalViews,
            label: '총 조회 횟수',
            icon: 'fas fa-eye',
            bgColor: 'from-green-500 to-green-600',
            shadowColor: 'shadow-green-200',
            badgeColor: 'text-green-600 bg-green-50',
            badgeText: '조회수'
        },
        {
            key: 'likes',
            value: stats.totalLikes,
            label: '받은 좋아요',
            icon: 'fas fa-heart',
            bgColor: 'from-pink-500 to-pink-600',
            shadowColor: 'shadow-pink-200',
            badgeColor: 'text-pink-600 bg-pink-50',
            badgeText: '좋아요'
        },
        {
            key: 'comments',
            value: stats.totalComments,
            label: '받은 댓글',
            icon: 'fas fa-comment',
            bgColor: 'from-purple-500 to-purple-600',
            shadowColor: 'shadow-purple-200',
            badgeColor: 'text-purple-600 bg-purple-50',
            badgeText: '댓글'
        }
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {statsCards.map((card) => (
                <div
                    key={card.key}
                    className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg transition-all duration-300 p-6 group hover:-translate-y-1">
                    <div className="flex items-center justify-between mb-4">
                        <div className={`w-12 h-12 bg-gradient-to-br ${card.bgColor} rounded-xl flex items-center justify-center text-white shadow-lg ${card.shadowColor}`}>
                            <i className={`${card.icon} text-xl`} />
                        </div>
                        <span className={`text-xs font-medium ${card.badgeColor} px-2 py-1 rounded-full`}>
                            {card.badgeText}
                        </span>
                    </div>
                    <div className="space-y-1">
                        <p className="text-2xl font-bold text-slate-900">{formatNumber(card.value)}</p>
                        <p className="text-sm text-slate-500">{card.label}</p>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default DashboardStats;
