import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';
import { useValue } from 'badland-react';

import { configStore } from '@stores/config';

export function ArticleDetailSkeleton() {
    const [ theme ] = useValue(configStore, 'theme');

    return (
        <SkeletonTheme
            baseColor={theme === 'dark' ? '#2A2A2A' : '#F5F5F8'}
            highlightColor={theme === 'dark' ? '#777' : '#999'}>
            <div className="container">
                <div className="row justify-content-center">
                    <div className="col-lg-9">
                        <Skeleton height={200} className="mb-3" />
                        <Skeleton height={35} className="mb-3" />
                        <Skeleton count={5} className="mb-1" />
                    </div>
                </div>
            </div>
        </SkeletonTheme>
    );
}
