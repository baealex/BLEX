import { useFetch } from '~/hooks/use-fetch';
import { postsApi } from '~/api/posts';


const DashboardActivities = () => {
    const { data: activitiesData, isLoading } = useFetch({
        queryKey: ['dashboard-activities'],
        queryFn: postsApi.getDashboardActivities
    });

    if (isLoading) {
        return (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                    <div className="h-6 bg-slate-200 rounded w-32 animate-pulse" />
                </div>
                <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="flex items-start gap-4 p-4 bg-slate-50 rounded-xl animate-pulse">
                            <div className="w-10 h-10 bg-slate-200 rounded-lg flex-shrink-0" />
                            <div className="flex-1 space-y-2">
                                <div className="h-4 bg-slate-200 rounded w-48" />
                                <div className="h-4 bg-slate-200 rounded w-32" />
                                <div className="h-3 bg-slate-200 rounded w-16" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    const activities = activitiesData?.activities || [];

    const getActivityIcon = (type: 'post' | 'comment' | 'like') => {
        switch (type) {
            case 'post':
                return {
                    icon: 'fas fa-file-alt',
                    bgColor: 'bg-gradient-to-br from-blue-500 to-blue-600',
                    text: '새 포스트를 작성했습니다'
                };
            case 'comment':
                return {
                    icon: 'fas fa-comment',
                    bgColor: 'bg-gradient-to-br from-purple-500 to-purple-600',
                    text: '댓글을 작성했습니다'
                };
            case 'like':
                return {
                    icon: 'fas fa-heart',
                    bgColor: 'bg-gradient-to-br from-pink-500 to-pink-600',
                    text: '좋아요를 눌렀습니다'
                };
            default:
                return {
                    icon: 'fas fa-clock',
                    bgColor: 'bg-gradient-to-br from-slate-500 to-slate-600',
                    text: '활동'
                };
        }
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-slate-900 flex items-center">
                    <i className="fas fa-clock mr-2 text-slate-600" />
                    최근 활동
                </h2>
            </div>

            <div className="space-y-4">
                {activities.length > 0 ? (
                    activities.map((activity, index) => {
                        const activityConfig = getActivityIcon(activity.type);
                        const displayTitle = activity.type === 'post' ? activity.title : activity.postTitle;

                        return (
                            <div key={index} className="flex items-start gap-4 p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors duration-200">
                                <div className={`w-10 h-10 ${activityConfig.bgColor} rounded-lg flex items-center justify-center text-white shadow-sm flex-shrink-0`}>
                                    <i className={activityConfig.icon} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-slate-900">{activityConfig.text}</p>
                                    <p className="text-slate-600 truncate">"{displayTitle}"</p>
                                    <p className="text-xs text-slate-500 mt-1">{activity.date}</p>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="text-center py-12">
                        <div className="w-16 h-16 mx-auto bg-slate-100 rounded-full flex items-center justify-center mb-4">
                            <i className="fas fa-clock text-slate-400 text-2xl" />
                        </div>
                        <h3 className="text-lg font-medium text-slate-900 mb-2">아직 활동이 없습니다</h3>
                        <p className="text-slate-500">첫 번째 포스트를 작성해보세요!</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DashboardActivities;
