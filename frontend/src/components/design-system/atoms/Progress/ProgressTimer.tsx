import classNames from 'classnames/bind';
import styles from './Progress.module.scss';
const cx = classNames.bind(styles);

import { useEffect, useRef, useState } from 'react';
import type { ProgressTimerProps } from './types';

export function ProgressTimer(props: ProgressTimerProps) {
    const ref = useRef<HTMLDivElement>(null);
    const [isRunning, setIsRunning] = useState(false);

    useEffect(() => {
        if (props.isReady) {
            setIsRunning(true);
        }
    }, [props.isReady, props.repeat]);

    useEffect(() => {
        const handleAnimationEnd = () => {
            setIsRunning(false);
            props.onEnd?.();

            if (props.repeat && ref.current) {
                ref.current.classList.remove(cx('progress-timer'));
                void ref.current.offsetWidth; // force reflow
                ref.current.classList.add(cx('progress-timer'));
                setIsRunning(true);
            }
        };
        ref.current?.addEventListener('animationend', handleAnimationEnd);

        return () => {
            ref.current?.removeEventListener('animationend', handleAnimationEnd);
        };
    }, [props.onEnd]);

    if (!props.isReady) {
        return null;
    }

    return (
        <div className={cx('progress', props.className)}>
            <div
                ref={ref}
                className={cx('progress-timer', { isReversed: props.isReversed })}
                role="progressbar"
                style={{
                    animationDuration: `${props.time}s`,
                    animationPlayState: isRunning ? 'running' : 'paused',
                    animationDirection: props.isReversed ? 'reverse' : 'normal'
                }}
            />
        </div>
    );
}