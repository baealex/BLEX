import styles from './CornerLoading.module.scss';
import classNames from 'classnames/bind';
const cn = classNames.bind(styles);

import { useEffect, useState } from 'react';

import { loadingContext } from '@state/loading';

export function CornerLoading() {
    const [isLoading, setIsLoading] = useState(loadingContext.state.isLoading);
    
    useEffect(() => {
        loadingContext.appendUpdater((state) => {
            setIsLoading(state.isLoading);
        })
    }, []);
    
    return (
        <>
            {isLoading &&(
                <div className={cn('box')}>
                    <div className="dot-pulse"/>
                </div>
            )}
        </>
    )
}