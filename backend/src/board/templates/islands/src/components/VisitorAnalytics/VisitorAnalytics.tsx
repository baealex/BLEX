import React, { useState, useEffect } from 'react';
import { http } from '~/modules/http.module';
import { notification } from '@baejino/ui';

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
            const { data } = await http<{ status: string; body: AnalyticsData }>(`v1/analytics?range=${dateRange}`, {
                method: 'GET'
            });

            if (data.status === 'DONE') {
                setAnalyticsData(data.body);
            } else {
                setError('데이터를 불러오는데 실패했습니다.');
                notification('방문자 통계를 불러오는데 실패했습니다.', { type: 'error' });
            }
        } catch (error) {
            setError('데이터를 불러오는데 실패했습니다.');
            notification('방문자 통계를 불러오는데 실패했습니다.', { type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const renderChart = () => {
        if (!analyticsData || !analyticsData.dailyStats.length) return null;

        const maxValue = Math.max(...analyticsData.dailyStats.map(stat => Math.max(stat.visitors, stat.pageViews)));
        const chartHeight = 200;

        return (
            <div className="analytics-chart">
                <div className="chart-container">
                    <div className="chart-y-axis">
                        {[...Array(5)].map((_, i) => {
                            const value = Math.round(maxValue * (4 - i) / 4);
                            return (
                                <div key={i} className="y-axis-label">
                                    {value}
                                </div>
                            );
                        })}
                    </div>
                    <div className="chart-content">
                        {analyticsData.dailyStats.map((stat, index) => {
                            const visitorHeight = (stat.visitors / maxValue) * chartHeight;
                            const pageViewHeight = (stat.pageViews / maxValue) * chartHeight;

                            return (
                                <div key={index} className="chart-bar-group">
                                    <div className="chart-bar-container">
                                        <div
                                            className="chart-bar visitors"
                                            style={{ height: `${visitorHeight}px` }}
                                            title={`방문자: ${stat.visitors}`}
                                        ></div>
                                        <div
                                            className="chart-bar pageviews"
                                            style={{ height: `${pageViewHeight}px` }}
                                            title={`페이지뷰: ${stat.pageViews}`}
                                        ></div>
                                    </div>
                                    <div className="chart-x-label">
                                        {stat.date.split('-').slice(1).join('/')}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
                <div className="chart-legend">
                    <div className="legend-item">
                        <div className="legend-color visitors"></div>
                        <div className="legend-label">방문자</div>
                    </div>
                    <div className="legend-item">
                        <div className="legend-color pageviews"></div>
                        <div className="legend-label">페이지뷰</div>
                    </div>
                </div>
            </div>
        );
    };

    const renderTopPosts = () => {
        if (!analyticsData || !analyticsData.topPosts.length) return null;

        return (
            <div className="analytics-card">
                <h3 className="card-title">인기 포스트</h3>
                <div className="top-posts">
                    {analyticsData.topPosts.map((post, index) => (
                        <div key={index} className="top-post-item">
                            <div className="post-rank">{index + 1}</div>
                            <div className="post-info">
                                <a href={`/${post.url}`} className="post-title" target="_blank" rel="noopener noreferrer">
                                    {post.title}
                                </a>
                            </div>
                            <div className="post-views">
                                <i className="fas fa-eye"></i> {post.views}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderTopReferrers = () => {
        if (!analyticsData || !analyticsData.topReferrers.length) return null;

        return (
            <div className="analytics-card">
                <h3 className="card-title">유입 경로</h3>
                <div className="top-referrers">
                    {analyticsData.topReferrers.map((referrer, index) => (
                        <div key={index} className="referrer-item">
                            <div className="referrer-domain">{referrer.domain || '직접 접속'}</div>
                            <div className="referrer-count">{referrer.count}</div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderDeviceStats = () => {
        if (!analyticsData || !analyticsData.deviceStats.length) return null;

        return (
            <div className="analytics-card">
                <h3 className="card-title">기기 통계</h3>
                <div className="device-stats">
                    {analyticsData.deviceStats.map((stat, index) => (
                        <div key={index} className="stat-item">
                            <div className="stat-label">{stat.device}</div>
                            <div className="stat-bar-container">
                                <div
                                    className="stat-bar"
                                    style={{ width: `${stat.percentage}%` }}
                                ></div>
                                <div className="stat-percentage">{stat.percentage}%</div>
                            </div>
                            <div className="stat-count">{stat.count}</div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderBrowserStats = () => {
        if (!analyticsData || !analyticsData.browserStats.length) return null;

        return (
            <div className="analytics-card">
                <h3 className="card-title">브라우저 통계</h3>
                <div className="browser-stats">
                    {analyticsData.browserStats.map((stat, index) => (
                        <div key={index} className="stat-item">
                            <div className="stat-label">{stat.browser}</div>
                            <div className="stat-bar-container">
                                <div
                                    className="stat-bar"
                                    style={{ width: `${stat.percentage}%` }}
                                ></div>
                                <div className="stat-percentage">{stat.percentage}%</div>
                            </div>
                            <div className="stat-count">{stat.count}</div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="visitor-analytics">
            <div className="analytics-header">
                <h3 className="analytics-title">방문자 통계</h3>
                <div className="date-range-selector">
                    <button
                        className={`btn ${dateRange === '7days' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setDateRange('7days')}
                    >
                        7일
                    </button>
                    <button
                        className={`btn ${dateRange === '30days' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setDateRange('30days')}
                    >
                        30일
                    </button>
                    <button
                        className={`btn ${dateRange === '90days' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setDateRange('90days')}
                    >
                        90일
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div className="loading-state">
                    <p>데이터를 불러오는 중...</p>
                </div>
            ) : error ? (
                <div className="error-state">
                    <p>{error}</p>
                    <button
                        className="btn btn-primary"
                        onClick={fetchAnalyticsData}
                    >
                        다시 시도
                    </button>
                </div>
            ) : analyticsData ? (
                <>
                    <div className="analytics-summary">
                        <div className="summary-card">
                            <div className="summary-value">{analyticsData.totalVisitors}</div>
                            <div className="summary-label">총 방문자</div>
                        </div>
                        <div className="summary-card">
                            <div className="summary-value">{analyticsData.totalPageViews}</div>
                            <div className="summary-label">총 페이지뷰</div>
                        </div>
                    </div>

                    {renderChart()}

                    <div className="analytics-grid">
                        <div className="grid-column">
                            {renderTopPosts()}
                        </div>
                        <div className="grid-column">
                            {renderTopReferrers()}
                        </div>
                    </div>

                    <div className="analytics-grid">
                        <div className="grid-column">
                            {renderDeviceStats()}
                        </div>
                        <div className="grid-column">
                            {renderBrowserStats()}
                        </div>
                    </div>
                </>
            ) : (
                <div className="empty-state">
                    <p>데이터가 없습니다.</p>
                </div>
            )}

            <style jsx>{`
        .visitor-analytics {
          position: relative;
        }

        .analytics-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .analytics-title {
          margin: 0;
          font-size: 18px;
        }

        .date-range-selector {
          display: flex;
          gap: 8px;
        }

        .loading-state,
        .error-state,
        .empty-state {
          padding: 40px 0;
          text-align: center;
          color: #6c757d;
        }

        .analytics-summary {
          display: flex;
          gap: 16px;
          margin-bottom: 24px;
        }

        .summary-card {
          flex: 1;
          background-color: #f8f9fa;
          border-radius: 8px;
          padding: 16px;
          text-align: center;
        }

        .summary-value {
          font-size: 24px;
          font-weight: 600;
          margin-bottom: 4px;
        }

        .summary-label {
          font-size: 14px;
          color: #6c757d;
        }

        .analytics-chart {
          margin-bottom: 24px;
          background-color: #f8f9fa;
          border-radius: 8px;
          padding: 16px;
        }

        .chart-container {
          display: flex;
          height: 240px;
        }

        .chart-y-axis {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding-right: 8px;
          width: 40px;
        }

        .y-axis-label {
          font-size: 12px;
          color: #6c757d;
          height: 20px;
          display: flex;
          align-items: center;
        }

        .chart-content {
          flex: 1;
          display: flex;
          align-items: flex-end;
          gap: 8px;
          height: 200px;
          border-bottom: 1px solid #ced4da;
          padding-bottom: 20px;
        }

        .chart-bar-group {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .chart-bar-container {
          display: flex;
          gap: 4px;
          height: 100%;
          width: 100%;
          align-items: flex-end;
        }

        .chart-bar {
          flex: 1;
          border-radius: 2px 2px 0 0;
          transition: height 0.3s ease;
        }

        .chart-bar.visitors {
          background-color: #4568dc;
        }

        .chart-bar.pageviews {
          background-color: #b06ab3;
        }

        .chart-x-label {
          font-size: 12px;
          color: #6c757d;
          margin-top: 4px;
        }

        .chart-legend {
          display: flex;
          justify-content: center;
          gap: 16px;
          margin-top: 8px;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .legend-color {
          width: 16px;
          height: 16px;
          border-radius: 2px;
        }

        .legend-color.visitors {
          background-color: #4568dc;
        }

        .legend-color.pageviews {
          background-color: #b06ab3;
        }

        .legend-label {
          font-size: 14px;
          color: #6c757d;
        }

        .analytics-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
          margin-bottom: 24px;
        }

        @media (min-width: 768px) {
          .analytics-grid {
            grid-template-columns: 1fr 1fr;
          }
        }

        .analytics-card {
          background-color: #f8f9fa;
          border-radius: 8px;
          padding: 16px;
        }

        .card-title {
          margin: 0 0 16px 0;
          font-size: 16px;
          font-weight: 600;
        }

        .top-posts,
        .top-referrers {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .top-post-item {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .post-rank {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #e9ecef;
          border-radius: 50%;
          font-size: 14px;
          font-weight: 600;
        }

        .post-info {
          flex: 1;
        }

        .post-title {
          color: #333;
          text-decoration: none;
          font-size: 14px;
          display: block;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .post-title:hover {
          color: #4568dc;
        }

        .post-views {
          font-size: 14px;
          color: #6c757d;
        }

        .referrer-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px solid #e0e0e0;
        }

        .referrer-item:last-child {
          border-bottom: none;
        }

        .referrer-domain {
          font-size: 14px;
        }

        .referrer-count {
          font-size: 14px;
          font-weight: 600;
        }

        .device-stats,
        .browser-stats {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .stat-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .stat-label {
          font-size: 14px;
        }

        .stat-bar-container {
          position: relative;
          height: 24px;
          background-color: #e9ecef;
          border-radius: 4px;
          overflow: hidden;
        }

        .stat-bar {
          height: 100%;
          background: linear-gradient(to right, #4568dc, #b06ab3);
          border-radius: 4px;
        }

        .stat-percentage {
          position: absolute;
          top: 0;
          right: 8px;
          height: 100%;
          display: flex;
          align-items: center;
          font-size: 12px;
          font-weight: 600;
          color: #fff;
        }

        .stat-count {
          font-size: 12px;
          color: #6c757d;
          text-align: right;
        }
      `}</style>
        </div>
    );
};

export default VisitorAnalytics;
