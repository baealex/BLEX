import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';
import { useValue } from 'badland-react';

import { configStore } from '@stores/config';

export function ArticleListSkeleton() {
    const [ theme ] = useValue(configStore, 'theme');

    return (
        <SkeletonTheme
            baseColor={theme === 'dark' ? '#2A2A2A' : '#F5F5F8'}
            highlightColor={theme === 'dark' ? '#666' : '#BABABA'}>
            <div className="container">
                <div className="row">
                    {Array.from({ length: 12 }, (_, i) => (
                        <div key={i} className="col-lg-4">
                            <Skeleton height={200} />
                            <div className="py-3 px-1">
                                <Skeleton height={35} />
                                <Skeleton count={3} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </SkeletonTheme>
    );
}
