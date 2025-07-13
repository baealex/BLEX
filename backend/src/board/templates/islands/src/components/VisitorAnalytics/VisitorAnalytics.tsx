import React, { useState, useEffect } from 'react';
import { http } from '~/modules/http.module';
import Chart from '../Chart/Chart';

interface AnalyticsData {
    totalVisitors: number;
    totalPageViews: number;
    dailyStats: {
        date: string;
        visitors: number;
        pageViews: number;
    }[];
    topPosts: {
        id: number;
        title: string;
        url: string;
        views: number;
    }[];
    topReferrers: {
        domain: string;
        count: number;
    }[];
    deviceStats: {
        device: string;
        count: number;
        percentage: number;
    }[];
    browserStats: {
        browser: string;
        count: number;
        percentage: number;
    }[];
}

const VisitorAnalytics: React.FC = () => {
    const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [dateRange, setDateRange] = useState<'7days' | '30days' | '90days'>('30days');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchAnalyticsData();
    }, [dateRange]);

    const fetchAnalyticsData = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const { data } = await http<{ status: string; body: AnalyticsData }>(`v1/analytics?range=${dateRange}`, { method: 'GET' });
            if (data.status === 'DONE') {
                setAnalyticsData(data.body);
            } else {
                setError('데이터를 불러오는데 실패했습니다.');
            }
        } catch (error) {
            setError('데이터를 불러오는데 실패했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="loading-container">
                <p>데이터를 불러오는 중...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="error-container">
                <p>{error}</p>
                <button className="retry-button" onClick={fetchAnalyticsData}>다시 시도</button>
            </div>
        );
    }

    if (!analyticsData) {
        return (
            <div className="empty-container">
                <p>데이터가 없습니다.</p>
            </div>
        );
    }

    // 차트 데이터 준비
    const chartData = {
        labels: analyticsData.dailyStats.map(stat => stat.date.split('-').slice(1).join('/')),
        datasets: [
            {
                name: '방문자',
                values: analyticsData.dailyStats.map(stat => stat.visitors),
                color: '#4568dc'
            },
            {
                name: '페이지뷰',
                values: analyticsData.dailyStats.map(stat => stat.pageViews),
                color: '#b06ab3'
            }
        ]
    };

    return (
        <>
            <div className="visitor-analytics">
                <div className="analytics-header">
                    <div className="summary">
                        <div className="summary-item">
                            <div className="summary-value">{analyticsData.totalVisitors}</div>
                            <div className="summary-label">총 방문자</div>
                        </div>
                        <div className="summary-item">
                            <div className="summary-value">{analyticsData.totalPageViews}</div>
                            <div className="summary-label">총 페이지뷰</div>
                        </div>
                    </div>
                    <div className="date-selector">
                        <button className={`date-button ${dateRange === '7days' ? 'active' : ''}`} onClick={() => setDateRange('7days')}>7일</button>
                        <button className={`date-button ${dateRange === '30days' ? 'active' : ''}`} onClick={() => setDateRange('30days')}>30일</button>
                        <button className={`date-button ${dateRange === '90days' ? 'active' : ''}`} onClick={() => setDateRange('90days')}>90일</button>
                    </div>
                </div>

                <div className="chart-container">
                    <Chart
                        type="line"
                        data={chartData}
                        height={300}
                        colors={['#4568dc', '#b06ab3']}
                        axisOptions={{ xIsSeries: 1 }}
                        lineOptions={{ hideDots: 0 }}
                        discreteDomains={1}
                    />
                </div>

                <div className="stats-grid">
                    <div className="stats-card">
                        <h3 className="card-title">인기 포스트</h3>
                        <div className="top-posts">
                            {analyticsData.topPosts.map((post, index) => (
                                <div key={index} className="post-item">
                                    <div className="post-rank">{index + 1}</div>
                                    <div className="post-info">
                                        <a href={`/${post.url}`} className="post-title">
                                            {post.title}
                                        </a>
                                    </div>
                                    <div className="post-views">
                                        <i className="fas fa-eye" /> {post.views}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="stats-card">
                        <h3 className="card-title">유입 경로</h3>
                        <div className="referrers">
                            {analyticsData.topReferrers.map((referrer, index) => (
                                <div key={index} className="referrer-item">
                                    <div className="referrer-domain">{referrer.domain || '직접 접속'}</div>
                                    <div className="referrer-count">{referrer.count}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="stats-card">
                        <h3 className="card-title">기기 통계</h3>
                        <div className="device-stats">
                            {analyticsData.deviceStats.map((stat, index) => (
                                <div key={index} className="stat-item">
                                    <div className="stat-label">{stat.device}</div>
                                    <div className="stat-bar-container">
                                        <div
                                            className="stat-bar"
                                            style={{ width: `${stat.percentage}%` }}
                                        />
                                        <div className="stat-percentage">{stat.percentage}%</div>
                                    </div>
                                    <div className="stat-count">{stat.count}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="stats-card">
                        <h3 className="card-title">브라우저 통계</h3>
                        <div className="browser-stats">
                            {analyticsData.browserStats.map((stat, index) => (
                                <div key={index} className="stat-item">
                                    <div className="stat-label">{stat.browser}</div>
                                    <div className="stat-bar-container">
                                        <div
                                            className="stat-bar"
                                            style={{ width: `${stat.percentage}%` }}
                                        />
                                        <div className="stat-percentage">{stat.percentage}%</div>
                                    </div>
                                    <div className="stat-count">{stat.count}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
            <style jsx>{`
                /* VisitorAnalytics 스타일 */
                .visitor-analytics {
                    background-color: #fff;
                    border-radius: 8px;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                    padding: 20px;
                    margin-bottom: 30px;
                }

                .analytics-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                    flex-wrap: wrap;
                    gap: 15px;
                }

                .summary {
                    display: flex;
                    gap: 20px;
                }

                .summary-item {
                    text-align: center;
                }

                .summary-value {
                    font-size: 24px;
                    font-weight: 700;
                    color: #333;
                }

                .summary-label {
                    font-size: 14px;
                    color: #666;
                }

                .date-selector {
                    display: flex;
                    gap: 10px;
                }

                .date-button {
                    padding: 6px 12px;
                    border: 1px solid #ddd;
                    background-color: #f9f9f9;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                    transition: all 0.2s ease;
                }

                .date-button:hover {
                    background-color: #eee;
                }

                .date-button.active {
                    background-color: #4568dc;
                    color: white;
                    border-color: #4568dc;
                }

                .chart-container {
                    margin-bottom: 30px;
                    border: 1px solid #eee;
                    border-radius: 8px;
                    padding: 15px;
                    background-color: #fcfcfc;
                }

                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                    gap: 20px;
                }

                .stats-card {
                    background-color: #fff;
                    border-radius: 8px;
                    border: 1px solid #eee;
                    padding: 15px;
                }

                .card-title {
                    font-size: 16px;
                    font-weight: 600;
                    margin-bottom: 15px;
                    color: #333;
                    border-bottom: 1px solid #eee;
                    padding-bottom: 10px;
                }

                /* 인기 포스트 스타일 */
                .top-posts {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }

                .post-item {
                    display: flex;
                    align-items: center;
                    padding: 8px 0;
                    border-bottom: 1px solid #f5f5f5;
                }

                .post-item:last-child {
                    border-bottom: none;
                }

                .post-rank {
                    font-weight: 700;
                    color: #4568dc;
                    width: 24px;
                    text-align: center;
                }

                .post-info {
                    flex: 1;
                    margin: 0 10px;
                    overflow: hidden;
                }

                .post-title {
                    color: #333;
                    font-size: 14px;
                    text-decoration: none;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    display: block;
                }

                .post-title:hover {
                    color: #4568dc;
                }

                .post-views {
                    font-size: 12px;
                    color: #888;
                    white-space: nowrap;
                }

                /* 유입 경로 스타일 */
                .referrers {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }

                .referrer-item {
                    display: flex;
                    justify-content: space-between;
                    padding: 8px 0;
                    border-bottom: 1px solid #f5f5f5;
                }

                .referrer-item:last-child {
                    border-bottom: none;
                }

                .referrer-domain {
                    font-size: 14px;
                    color: #333;
                    max-width: 70%;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .referrer-count {
                    font-size: 14px;
                    color: #666;
                    font-weight: 500;
                }

                /* 기기 및 브라우저 통계 스타일 */
                .device-stats,
                .browser-stats {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .stat-item {
                    display: flex;
                    flex-direction: column;
                    gap: 5px;
                }

                .stat-label {
                    font-size: 14px;
                    color: #333;
                    display: flex;
                    justify-content: space-between;
                }

                .stat-bar-container {
                    height: 8px;
                    background-color: #f0f0f0;
                    border-radius: 4px;
                    position: relative;
                    overflow: hidden;
                    margin: 5px 0;
                }

                .stat-bar {
                    height: 100%;
                    background: linear-gradient(to right, #4568dc, #b06ab3);
                    border-radius: 4px;
                }   

                .stat-percentage {
                    font-size: 12px;
                    color: #666;
                    text-align: right;
                }

                .stat-count {
                    font-size: 12px;
                    color: #888;
                }

                /* 로딩, 에러, 빈 상태 스타일 */
                .loading-container,
                .error-container,
                .empty-container {
                    padding: 40px;
                    text-align: center;
                    color: #666;
                    background-color: #f9f9f9;
                    border-radius: 8px;
                    border: 1px dashed #ddd;
                }

                .retry-button {
                    margin-top: 15px;
                    padding: 8px 16px;
                    background-color: #4568dc;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                }

                .retry-button:hover {
                    background-color: #3a57c4;
                }

                /* 반응형 스타일 */
                @media (max-width: 768px) {
                    .analytics-header {
                        flex-direction: column;
                        align-items: flex-start;
                    }
                
                    .stats-grid {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </>
    );
};

export default VisitorAnalytics;
