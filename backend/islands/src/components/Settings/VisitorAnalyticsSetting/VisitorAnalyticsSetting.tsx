import { useState, useMemo } from 'react';
import Chart from '~/components/Chart';
import { handyDate } from '@baejino/handy';
import { useFetch } from '~/hooks/use-fetch';
import { settingsApi } from '~/api/settings';

const VisitorAnalytics = () => {
    const [date, setDate] = useState(new Date());
    const visibleDate = useMemo(() => handyDate.format(date, 'YYYY-MM-DD'), [date]);

    const { data: views, isLoading } = useFetch({
        queryKey: ['setting', 'analytics-view'],
        queryFn: settingsApi.getAnalyticsView
    });

    const { data: postViews, isLoading: isLoadingPostsView } = useFetch({
        queryKey: ['setting', 'analytics-posts-view', visibleDate],
        queryFn: () => settingsApi.getAnalyticsPostsView(visibleDate)
    });

    const monthTotal = useMemo(() => {
        if (!views?.body?.views) return 0;
        return views.body.views.reduce((acc, cur) => acc + cur.count, 0);
    }, [views]);

    return (
        <div className="p-4 sm:p-6 bg-white shadow-sm rounded-lg space-y-4 sm:space-y-6">
            {/* Header Section */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl font-bold text-blue-900 mb-2 flex items-center">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 mr-2 text-blue-700" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                    </svg>
                    방문자 통계
                </h2>
                <p className="text-blue-700">블로그 조회수 추이와 인기 글을 확인해보세요.</p>
            </div>

            {isLoading ? (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 sm:p-6">
                    <div className="animate-pulse">
                        <div className="h-5 bg-gray-200 rounded w-24 mb-4" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
                            <div className="h-20 bg-gray-200 rounded" />
                            <div className="h-20 bg-gray-200 rounded" />
                        </div>
                        <div className="h-64 bg-gray-200 rounded" />
                    </div>
                </div>
            ) : views && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 sm:p-6">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 sm:mb-6 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        조회수 추이
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
                        <div className="bg-white rounded-lg p-4 sm:p-6 border border-gray-200 shadow-sm">
                            <div className="flex items-center">
                                <div className="p-2 bg-blue-100 rounded-lg mr-3">
                                    <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-600">총 조회수</p>
                                    <p className="text-xl sm:text-2xl font-bold text-gray-900">{views.body.total.toLocaleString()}</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-lg p-4 sm:p-6 border border-gray-200 shadow-sm">
                            <div className="flex items-center">
                                <div className="p-2 bg-green-100 rounded-lg mr-3">
                                    <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-600">월간 조회수</p>
                                    <p className="text-xl sm:text-2xl font-bold text-gray-900">{monthTotal?.toLocaleString()}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                        <Chart
                            type="axis-mixed"
                            data={{
                                labels: views.dates,
                                datasets: [
                                    {
                                        name: 'View',
                                        values: views.counts,
                                        chartType: 'line'
                                    }
                                ]
                            }}
                            colors={['#A076F1']}
                            lineOptions={{ hideDots: 1 }}
                            axisOptions={{ xIsSeries: 1 }}
                        />
                    </div>
                </div>
            )}

            {isLoadingPostsView && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 sm:p-6">
                    <div className="animate-pulse">
                        <div className="h-5 bg-gray-200 rounded w-32 mb-4" />
                        <div className="space-y-3">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="h-12 bg-gray-200 rounded" />
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {!isLoadingPostsView && postViews && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6">
                        <div className="flex items-center mb-4 sm:mb-0">
                            <svg className="w-5 h-5 mr-2 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
                            </svg>
                            <input
                                type="date"
                                value={visibleDate}
                                onChange={(e) => setDate(new Date(e.target.value))}
                                className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm mr-2 w-full sm:w-auto"
                            />
                            <span className="text-sm font-medium text-gray-700 hidden sm:inline">의 인기글</span>
                        </div>
                        <div className="flex space-x-2">
                            <button
                                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation min-h-[44px]"
                                disabled={date <= new Date(new Date().setDate(new Date().getDate() - 30))}
                                onClick={() => setDate(new Date(date.setDate(new Date(date).getDate() - 1)))}>
                                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                이전
                            </button>
                            <button
                                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation min-h-[44px]"
                                disabled={date >= new Date(new Date().setDate(new Date().getDate() - 1))}
                                onClick={() => setDate(new Date(date.setDate(new Date(date).getDate() + 1)))}>
                                다음
                                <svg className="w-4 h-4 ml-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div className="text-sm font-medium text-gray-700 mb-4 sm:hidden">
                        {visibleDate}의 인기글
                    </div>

                    {postViews.posts.length === 0 ? (
                        <div className="text-center py-12">
                            <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">아직 작성한 포스트가 없습니다</h3>
                            <p className="text-gray-500">첫 번째 글을 작성해보세요!</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {postViews.posts.map((item, index) => (
                                <div key={item.url} className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 shadow-sm hover:shadow-sm transition-shadow">
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                                        <div className="flex items-center space-x-3 flex-1">
                                            <div className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 bg-blue-100 text-blue-600 rounded-full text-xs sm:text-sm font-semibold flex-shrink-0">
                                                {index + 1}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-sm font-medium text-gray-900 line-clamp-1 sm:line-clamp-2">
                                                    {item.title}
                                                </h4>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-end sm:justify-start space-x-2 sm:space-x-3 text-sm">
                                            <span className="inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                                    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                                </svg>
                                                <span className="hidden sm:inline">{item.todayCount}명 읽음</span>
                                                <span className="sm:hidden">{item.todayCount}</span>
                                            </span>
                                            <span
                                                className={`inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-xs font-medium ${item.increaseCount > 0
                                                    ? 'bg-green-100 text-green-800'
                                                    : item.increaseCount < 0
                                                        ? 'bg-red-100 text-red-800'
                                                        : 'bg-gray-100 text-gray-800'
                                                    }`}>
                                                {item.increaseCount > 0 ? '↑' : item.increaseCount < 0 ? '↓' : '='}
                                                {Math.abs(item.increaseCount)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default VisitorAnalytics;
