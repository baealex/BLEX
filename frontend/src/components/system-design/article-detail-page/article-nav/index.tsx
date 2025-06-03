import classNames from 'classnames/bind';
import styles from './ArticleNav.module.scss';
const cx = classNames.bind(styles);

import { useEffect, useState } from 'react';

import { useStore } from 'badland-react';
import { configStore } from '~/stores/config';

import { Text } from '~/components/design-system';

interface Props {
    renderedContent: string;
}

export function ArticleNav(props: Props) {
    const [headerNav, setHeaderNav] = useState<string[][]>([]);
    const [headerNow, setHeaderNow] = useState<string>('');
    const [{ theme }] = useStore(configStore);
    const isDarkMode = theme === 'dark';

    useEffect(() => {
        if ('IntersectionObserver' in window) {
            const headers = document.querySelectorAll('h1, h2, h3, h4, h5, h6');

            if (headers) {
                const headerNavArray: string[][] = [];

                headers.forEach((header) => {
                    const level = header.tagName.replace('H', '');
                    const id = header.id;
                    const text = header.textContent || '';

                    if (id) {
                        headerNavArray.push([level, id, text]);
                    }
                });

                setHeaderNav(headerNavArray);

                const observer = new IntersectionObserver(
                    (entries) => {
                        entries.forEach((entry) => {
                            if (entry.isIntersecting) {
                                setHeaderNow(entry.target.id);
                            }
                        });
                    },
                    { rootMargin: '-10% 0px -90% 0px' }
                );

                headers.forEach((header) => {
                    observer.observe(header);
                });

                return () => observer.disconnect();
            }
        }
    }, [props.renderedContent]);

    const headings = headerNav.map((item) => ({
        id: item[1],
        text: item[2],
        level: Number(item[0])
    }));

    const activeId = headerNow;

    const handleClickHeading = (e: React.MouseEvent<HTMLAnchorElement>) => {
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
    };

    if (headings.length === 0) {
        return null;
    }

    return (
        <div className={cx('article-nav')}>
            <div className={cx('article-nav-inner', { 'dark-mode': isDarkMode })}>
                <div className={cx('article-nav-title')}>
                    <Text fontSize={4} fontWeight={600}>목차</Text>
                </div>
                <div className={cx('article-nav-content')}>
                    <ul>
                        {headings.map((heading, index) => (
                            <li
                                key={index}
                                style={{ paddingLeft: `${(heading.level - 1) * 10}px` }}>
                                <a
                                    href={`#${heading.id}`}
                                    onClick={handleClickHeading}
                                    className={cx({ active: heading.id === activeId })}>
                                    {heading.text}
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
}
