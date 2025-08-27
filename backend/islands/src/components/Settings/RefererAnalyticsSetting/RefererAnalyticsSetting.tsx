import React from 'react';
import { http } from '~/modules/http.module';
import { useFetch } from '~/hooks/use-fetch';
import type { Response } from '~/modules/http.module';

interface RefererItem {
    url: string;
    title?: string;
    description?: string;
    time: string;
    posts: {
        author: string;
        url: string;
        title: string;
    };
}

interface RefererAnalytics {
    referers: RefererItem[];
}

const RefererAnalytics: React.FC = () => {
    const { data: referers, isLoading } = useFetch({
        queryKey: ['setting', 'analytics-referer'],
        queryFn: async () => {
            const { data } = await http.get<Response<RefererAnalytics>>('/v1/setting/analytics-referer');
            if (data.status === 'DONE') {
                return data.body;
            }
            return null;
        }
    });

    return (
        <div className="p-4 sm:p-6 bg-white shadow-md rounded-lg">
            {/* Header Section */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
                <h2 className="text-lg sm:text-xl font-bold text-green-900 mb-2 flex items-center">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 mr-2 text-green-700" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
                    </svg>
                    신규 유입 경로
                </h2>
                <p className="text-green-700">최근 블로그로 방문자들이 어떤 경로를 통해 유입되었는지 확인해보세요.</p>
            </div>

            {isLoading ? (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 sm:p-6">
                    <div className="animate-pulse space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                                <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
                                <div className="h-4 bg-gray-200 rounded w-full mb-2" />
                                <div className="h-3 bg-gray-200 rounded w-24 mb-2" />
                                <div className="h-3 bg-gray-200 rounded w-48" />
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 sm:p-6">
                    {referers?.referers.length === 0 ? (
                        <div className="text-center py-12">
                            <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">신규 유입 경로가 없습니다</h3>
                            <p className="text-gray-500">아직 외부 사이트에서의 유입이 감지되지 않았습니다.</p>
                        </div>
                ) : (
                    <div className="space-y-4">
                        {referers?.referers.map((item, index) => (
                            <div key={index} className="bg-white border border-gray-200 rounded-lg p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-3 space-y-2 sm:space-y-0">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1">
                                            <a
                                                href={item.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="hover:text-green-600 transition-colors flex items-center break-all sm:break-normal">
                                                <span className="truncate">{item.title || item.url}</span>
                                                <svg className="w-4 h-4 ml-1 text-gray-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                                                </svg>
                                            </a>
                                        </h3>
                                        {item.description && (
                                            <p className="text-gray-600 text-sm mb-2 line-clamp-2">
                                                {item.description}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-end sm:justify-start text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full sm:ml-4 self-start">
                                        <svg className="w-3 h-3 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                        </svg>
                                        {item.time}
                                    </div>
                                </div>

                                <div className="border-t border-gray-100 pt-3">
                                    <div className="flex flex-col sm:flex-row sm:items-center text-sm space-y-1 sm:space-y-0">
                                        <span className="text-gray-500 mr-2 flex-shrink-0">연결된 글:</span>
                                        <a
                                            href={`/@${item.posts.author}/${item.posts.url}`}
                                            className="font-medium text-green-600 hover:text-green-700 transition-colors flex items-center min-w-0">
                                            <svg className="w-4 h-4 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <span className="truncate">{item.posts.title}</span>
                                        </a>
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

export default RefererAnalytics;