import classNames from 'classnames/bind';
import styles from './ArticleNav.module.scss';
const cn = classNames.bind(styles);

import { useCallback, useEffect, useState } from 'react';

interface Props {
    text: string;
}

export function ArticleNav(props: Props) {
    const [headerNav, setHeaderNav] = useState<string[][]>([]);
    const [headerNow, setHeaderNow] = useState<string>('');

    const handleClickArticleNav = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();

        const hash = e.currentTarget.hash.replace('#', '');
        const $el = document.getElementById(decodeURIComponent(hash));

        if ($el) {
            const offset = $el.getBoundingClientRect().top + window.scrollY;

            window.scroll({
                top: offset - (window.scrollY < offset ? 15 : 90),
                left: 0,
                behavior: 'smooth'
            });
            history.pushState(null, '', e.currentTarget.hash);
        }
    }, []);

    useEffect(() => {
        if ('IntersectionObserver' in window) {
            const headersTags = document.querySelectorAll(
                'h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]'
            );
            const headerNav: string[][] = [];

            const observer = new IntersectionObserver(entries => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        setHeaderNow(entry.target.id);
                    }
                });
            }, { rootMargin: '0px 0px -90%' });

            headersTags.forEach(header => {
                const idNumber = Math.ceil(Number(header.tagName.toUpperCase().replace('H', '')) / 2);
                headerNav.push([
                    idNumber.toString(), header.id, header.textContent ? header.textContent : ''
                ]);
                observer.observe(header);
            });

            setHeaderNav(headerNav);

            return () => observer.disconnect();
        }
    }, [props.text]);

    return (
        <aside className={cn('article-nav', 'sticky-top sticky-top-100 none-drag')}>
            <ul>
                {headerNav.map((item, idx) => (
                    <li key={idx} className={cn(`title-${item[0]}`)}>
                        <a
                            href={`#${item[1]}`}
                            onClick={handleClickArticleNav}
                            className={cn({ 'nav-now': headerNow == item[1] })}>
                            {item[2]}
                        </a>
                    </li>
                ))}
            </ul>
        </aside>
    );
}
