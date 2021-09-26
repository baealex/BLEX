import styles from './Footer.module.scss';
import classNames from 'classnames/bind';
const cn = classNames.bind(styles);

import { useState, useEffect } from 'react';

export interface FooterProps {
    bgdark?: boolean;
    children?: JSX.Element;
};

export function Footer({
    bgdark = false,
    children,
}: FooterProps) {
    const [ idx, setIdx ] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setIdx((prevIdx) => {
                if (prevIdx < 2) return prevIdx + 1;
                return 0;
            });
        }, 6000);

        return () => clearInterval(interval);
    }, []);

    return (
        <footer className={cn('footer', { bgdark })}>
            {children && (
                <div className={cn('content')}>
                    {children}
                </div>
            )}
            <div className={cn('copy', 'text-center')}>
                <span>블로그는 나를 표현한다. 나를 표현하는 블렉스.</span>
                <span>블렉스는 <a href="https://github.com/baealex/BLEX">모든 소스가 공개된</a> 서비스입니다.</span>
                <span>오류가 있나요? <a href="mailto:im@baejino.com">메일을 통해</a> 알려주세요!</span>
                <style jsx>{`
                    span {
                        display: block;
                        height: 30px;
                        transition: transform 0.5s ease;
                        transform: translateY(${`-${idx * 100}%`});
                    }
                `}</style>
            </div>
        </footer>
    );
}