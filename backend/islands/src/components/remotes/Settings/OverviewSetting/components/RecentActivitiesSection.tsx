import type { Activity } from '../OverviewSetting';

interface RecentActivitiesSectionProps {
    activities: Activity[];
    isLoading: boolean;
}

const RecentActivitiesSection = ({ activities, isLoading }: RecentActivitiesSectionProps) => {
    const getActivityIcon = (type: Activity['type']) => {
        switch (type) {
            case 'post':
                return {
                    icon: 'fas fa-file-alt',
                    bgColor: 'bg-black',
                    text: '새 포스트를 작성했습니다'
                };
            case 'series':
                return {
                    icon: 'fas fa-bookmark',
                    bgColor: 'bg-black',
                    text: '새 시리즈를 생성했습니다'
                };
            case 'comment':
                return {
                    icon: 'fas fa-comment',
                    bgColor: 'bg-black',
                    text: '댓글을 작성했습니다'
                };
            case 'like':
                return {
                    icon: 'fas fa-heart',
                    bgColor: 'bg-black',
                    text: '좋아요를 눌렀습니다'
                };
            default:
                return {
                    icon: 'fas fa-clock',
                    bgColor: 'bg-black',
                    text: '활동'
                };
        }
    };

    return (
        <div className="p-6 bg-white shadow-sm rounded-2xl border border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <i className="fas fa-clock mr-3" />
                최근 활동
            </h2>

            {isLoading ? null : (
                <div className="space-y-3">
                    {activities.length > 0 ? (
                        activities.slice(0, 5).map((activity, index) => {
                            const activityConfig = getActivityIcon(activity.type);
                            const displayTitle = activity.type === 'post' || activity.type === 'series' ? activity.title : activity.postTitle;

                            return (
                                <a
                                    key={index}
                                    href={activity.url}
                                    className="flex items-start gap-3 p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-all duration-300 cursor-pointer">
                                    <div className={`w-10 h-10 ${activityConfig.bgColor} rounded-xl flex items-center justify-center text-white flex-shrink-0`}>
                                        <i className={`${activityConfig.icon} text-sm`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-gray-900 text-sm mb-1">{activityConfig.text}</p>
                                        <p className="text-gray-600 truncate text-sm mb-1">"{displayTitle}"</p>
                                        <p className="text-xs text-gray-500">{activity.date}</p>
                                    </div>
                                </a>
                            );
                        })
                    ) : (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 mx-auto bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center mb-4">
                                <i className="fas fa-clock text-gray-400 text-2xl" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-1">아직 활동이 없습니다</h3>
                            <p className="text-gray-500 text-sm">첫 번째 포스트를 작성해보세요!</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default RecentActivitiesSection;
