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

const Loading = () => {
    return (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div className="spinner-border" role="status">
                <span className="visually-hidden">로딩중...</span>
            </div>
            <div style={{ marginTop: '1rem' }}>데이터를 불러오는 중...</div>
        </div>
    );
};

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

    if (isLoading) return <Loading />;

    return (
        <div className="card setting-card">
            <div className="card-header">
                <h5 className="card-title mb-0">신규 유입 경로</h5>
            </div>
            <div className="card-body">
                {referers?.referers.length === 0 ? (
                    <div className="alert alert-info">
                        신규 유입 경로가 없습니다.
                    </div>
                ) : (
                    <div className="row">
                        {referers?.referers.map((item, index) => (
                            <div key={index} className="col-12 mb-3">
                                <div className="card">
                                    <div className="card-body">
                                        <div className="mb-2">
                                            <a 
                                                href={item.url} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="text-decoration-none text-dark"
                                            >
                                                {item.title || item.url}
                                            </a>
                                        </div>
                                        {item.description && (
                                            <div className="text-muted small mb-2">
                                                <a 
                                                    href={item.url} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="text-decoration-none text-muted"
                                                >
                                                    {item.description}
                                                </a>
                                            </div>
                                        )}
                                        <div className="text-muted small mb-2">
                                            {item.time}
                                        </div>
                                        <div className="mt-2">
                                            <a 
                                                href={`/@${item.posts.author}/${item.posts.url}`} 
                                                className="text-decoration-none text-muted small"
                                            >
                                                → {item.posts.title}
                                            </a>
                                        </div>
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

export default RefererAnalytics;