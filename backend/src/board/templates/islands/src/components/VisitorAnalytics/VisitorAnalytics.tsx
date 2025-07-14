import { useState, useMemo } from 'react';
import { http } from '~/modules/http.module';
import Chart from '../Chart/Chart';
import { handyDate } from '@baejino/handy';
import { useFetch } from '~/hooks/use-fetch';
import type { Response } from '~/modules/http.module';

interface AnalyticsView {
    username: string;
    total: number;
    views: {
        date: string;
        count: number;
    }[];
}

interface PostView {
    posts: {
        id: number;
        url: string;
        title: string;
        author: string;
        todayCount: number;
        increaseCount: number;
    }[];
}

const Loading = () => {
    return (
        <div className="loading-container">
            <div className="loading-spinner" />
            <div>데이터를 불러오는 중...</div>
            <style jsx>{`
                .loading-container {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 2rem;
                    color: #666;
                }
                .loading-spinner {
                    border: 3px solid rgba(0, 0, 0, 0.1);
                    border-radius: 50%;
                    border-top: 3px solid #A076F1;
                    width: 30px;
                    height: 30px;
                    animation: spin 1s linear infinite;
                    margin-bottom: 1rem;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

const VisitorAnalytics = () => {
    const [date, setDate] = useState(new Date());
    const visibleDate = useMemo(() => handyDate.format(date, 'YYYY-MM-DD'), [date]);

    const { data: views, isLoading } = useFetch({
        queryKey: ['setting', 'analytics-view'],
        queryFn: async () => {
            const { data } = await http.get<Response<AnalyticsView>>('/v1/setting/analytics-view');
            return {
                ...data,
                dates: data.body.views.map(item => item.date).reverse(),
                counts: data.body.views.map(item => item.count).reverse()
            };
        }
    });

    const { data: postViews, isLoading: isLoadingPostsView } = useFetch({
        queryKey: ['setting', 'analytics-posts-view', visibleDate],
        queryFn: async () => {
            const { data } = await http.get<Response<PostView>>('/v1/setting/analytics-posts-view', { params: { date: visibleDate } });
            return data.body;
        }
    });

    const monthTotal = useMemo(() => views?.body.views.reduce((acc, cur) => acc + cur.count, 0), [views]);

    if (isLoading) return <Loading />;

    return (
        <div className="analytics-container">
            {views && (
                <div className="analytics-card">
                    <h2 className="section-title">조회수 추이</h2>
                    <div className="stats-container">
                        <div className="stats-item">
                            <span className="stats-label">총 조회수</span>
                            <span className="stats-value">{views.body.total.toLocaleString()}</span>
                        </div>
                        <div className="stats-item">
                            <span className="stats-label">월간 조회수</span>
                            <span className="stats-value">{monthTotal?.toLocaleString()}</span>
                        </div>
                    </div>
                    <div className="chart-container">
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
                <div className="popular-posts-card">
                    <Loading />
                </div>
            )}

            {!isLoadingPostsView && postViews && (
                <div className="popular-posts-card">
                    <div className="date-selector">
                        <div className="date-input-group">
                            <input
                                type="date"
                                value={visibleDate}
                                onChange={(e) => setDate(new Date(e.target.value))}
                                className="date-input"
                            />
                            <div className="date-label">의 인기글</div>
                        </div>
                        <div className="date-navigation">
                            <button
                                className="nav-button prev-button"
                                disabled={date <= new Date(new Date().setDate(new Date().getDate() - 30))}
                                onClick={() => setDate(new Date(date.setDate(new Date(date).getDate() - 1)))}>
                                이전
                            </button>
                            <button
                                className="nav-button next-button"
                                disabled={date >= new Date(new Date().setDate(new Date().getDate() - 1))}
                                onClick={() => setDate(new Date(date.setDate(new Date(date).getDate() + 1)))}>
                                다음
                            </button>
                        </div>
                    </div>

                    {postViews.posts.length === 0 ? (
                        <div className="no-posts-message">
                            아직 작성한 포스트가 없습니다.
                        </div>
                    ) : (
                        <div className="posts-list">
                            {postViews.posts.map((item) => (
                                <div key={item.url} className="post-item">
                                    <div className="post-title">
                                        {item.title}
                                    </div>
                                    <div className="post-stats">
                                        <span className="view-count">{item.todayCount}명 읽음</span>
                                        <span className={`change-count ${item.increaseCount > 0 ? 'increase' : item.increaseCount < 0 ? 'decrease' : 'no-change'}`}>
                                            ({`${item.increaseCount > 0 ? '↑' : item.increaseCount < 0 ? '↓' : ''}${Math.abs(item.increaseCount)}`})
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <style jsx>{`
                .analytics-container {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                    max-width: 100%;
                    margin: 0 auto;
                    color: #333;
                }

                .analytics-card, .popular-posts-card {
                    background-color: #fff;
                    border-radius: 8px;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
                    padding: 1.5rem;
                    margin-bottom: 2rem;
                }

                .section-title {
                    font-size: 1.25rem;
                    font-weight: 600;
                    margin: 0 0 1rem 0;
                    color: #333;
                }

                .stats-container {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 1.5rem;
                    margin-bottom: 1.5rem;
                }

                .stats-item {
                    display: flex;
                    flex-direction: column;
                }

                .stats-label {
                    font-size: 0.875rem;
                    color: #666;
                    margin-bottom: 0.25rem;
                }

                .stats-value {
                    font-size: 1.125rem;
                    font-weight: 600;
                    color: #333;
                }

                .chart-container {
                    margin-top: 1rem;
                    border-radius: 4px;
                    overflow: hidden;
                }

                .date-selector {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1.5rem;
                }

                .date-input-group {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }

                .date-input {
                    padding: 0.5rem;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    font-size: 0.9rem;
                    color: #333;
                }

                .date-label {
                    font-size: 0.95rem;
                    color: #555;
                }

                .date-navigation {
                    display: flex;
                    gap: 0.5rem;
                }

                .nav-button {
                    padding: 0.5rem 1rem;
                    border: none;
                    border-radius: 4px;
                    background-color: #f0f0f0;
                    color: #333;
                    cursor: pointer;
                    font-size: 0.9rem;
                    transition: background-color 0.2s;
                }

                .nav-button:hover:not(:disabled) {
                    background-color: #e0e0e0;
                }

                .nav-button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .no-posts-message {
                    text-align: center;
                    padding: 2rem 0;
                    color: #666;
                    font-size: 0.95rem;
                }

                .posts-list {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                .post-item {
                    padding: 1rem;
                    border-radius: 6px;
                    background-color: #f9f9f9;
                    transition: transform 0.2s, box-shadow 0.2s;
                }

                .post-item:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 3px 6px rgba(0, 0, 0, 0.1);
                }

                .loading-container {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 2rem;
                    color: #666;
                }

                .loading-spinner {
                    display: inline-block;
                    width: 20px;
                    height: 20px;
                    border: 3px solid #f3f3f3;
                    border-top: 3px solid #3498db;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                .post-title {
                    font-size: 1rem;
                    font-weight: 500;
                    margin-bottom: 0.5rem;
                    color: #222;
                }

                .post-stats {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.9rem;
                    color: #555;
                }

                .view-count {
                    font-weight: 500;
                }

                .change-count {
                    font-weight: 500;
                }

                .increase {
                    color: #ff6700;
                }

                .no-change {
                    color: #4e4e4e;
                }

                .decrease {
                    color: #008fff;
                }

                .mt-4 {
                    margin-top: 1.5rem;
                }
            `}</style>
        </div>
    );
};

export default VisitorAnalytics;
