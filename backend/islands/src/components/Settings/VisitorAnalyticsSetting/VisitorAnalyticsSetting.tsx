import { useState, useMemo } from 'react';
import { http } from '~/modules/http.module';
import Chart from '~/components/Chart';
import { handyDate } from '@baejino/handy';
import { useFetch } from '~/hooks/use-fetch';
import type { Response } from '~/modules/http.module';
import styles from './VisitorAnalytics.module.scss';

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
        <div className={styles.loadingContainer}>
            <div className={styles.loadingSpinner} />
            <div>데이터를 불러오는 중...</div>
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
            if (data.status === 'DONE') {
                return {
                    ...data,
                    dates: data.body.views.map(item => item.date).reverse(),
                    counts: data.body.views.map(item => item.count).reverse()
                };
            }
            return null;
        }
    });

    const { data: postViews, isLoading: isLoadingPostsView } = useFetch({
        queryKey: ['setting', 'analytics-posts-view', visibleDate],
        queryFn: async () => {
            const { data } = await http.get<Response<PostView>>('/v1/setting/analytics-posts-view', { params: { date: visibleDate } });
            if (data.status === 'DONE') {
                return data.body;
            }
            return null;
        }
    });

    const monthTotal = useMemo(() => views?.body.views.reduce((acc, cur) => acc + cur.count, 0), [views]);

    if (isLoading) return <Loading />;

    return (
        <div className={styles.analyticsContainer}>
            {views && (
                <div className={styles.analyticsCard}>
                    <h2 className={styles.sectionTitle}>조회수 추이</h2>
                    <div className={styles.statsContainer}>
                        <div className={styles.statsItem}>
                            <span className={styles.statsLabel}>총 조회수</span>
                            <span className={styles.statsValue}>{views.body.total.toLocaleString()}</span>
                        </div>
                        <div className={styles.statsItem}>
                            <span className={styles.statsLabel}>월간 조회수</span>
                            <span className={styles.statsValue}>{monthTotal?.toLocaleString()}</span>
                        </div>
                    </div>
                    <div className={styles.chartContainer}>
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
                <div className={styles.popularPostsCard}>
                    <Loading />
                </div>
            )}

            {!isLoadingPostsView && postViews && (
                <div className={styles.popularPostsCard}>
                    <div className={styles.dateSelector}>
                        <div className={styles.dateInputGroup}>
                            <input
                                type="date"
                                value={visibleDate}
                                onChange={(e) => setDate(new Date(e.target.value))}
                                className={styles.dateInput}
                            />
                            <div className={styles.dateLabel}>의 인기글</div>
                        </div>
                        <div className={styles.dateNavigation}>
                            <button
                                className={`${styles.navButton} ${styles.prevButton}`}
                                disabled={date <= new Date(new Date().setDate(new Date().getDate() - 30))}
                                onClick={() => setDate(new Date(date.setDate(new Date(date).getDate() - 1)))}>
                                이전
                            </button>
                            <button
                                className={`${styles.navButton} ${styles.nextButton}`}
                                disabled={date >= new Date(new Date().setDate(new Date().getDate() - 1))}
                                onClick={() => setDate(new Date(date.setDate(new Date(date).getDate() + 1)))}>
                                다음
                            </button>
                        </div>
                    </div>

                    {postViews.posts.length === 0 ? (
                        <div className={styles.noPostsMessage}>
                            아직 작성한 포스트가 없습니다.
                        </div>
                    ) : (
                        <div className={styles.postsList}>
                            {postViews.posts.map((item) => (
                                <div key={item.url} className={styles.postItem}>
                                    <div className={styles.postTitle}>
                                        {item.title}
                                    </div>
                                    <div className={styles.postStats}>
                                        <span className={styles.viewCount}>{item.todayCount}명 읽음</span>
                                        <span className={`${styles.changeCount} ${item.increaseCount > 0 ? styles.increase : item.increaseCount < 0 ? styles.decrease : styles.noChange}`}>
                                            ({`${item.increaseCount > 0 ? '↑' : item.increaseCount < 0 ? '↓' : ''}${Math.abs(item.increaseCount)}`})
                                        </span>
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
