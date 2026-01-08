import React, { useEffect, useState } from 'react';

interface TOCItem {
    id: string;
    text: string;
    level: number;
}

interface TableOfContentsProps {
    contentSelector?: string;
}

const TableOfContents: React.FC<TableOfContentsProps> = ({
    contentSelector = '.blog-post-content'
}) => {
    const [toc, setToc] = useState<TOCItem[]>([]);
    const [activeId, setActiveId] = useState<string>('');

    useEffect(() => {
        const contentElement = document.querySelector(contentSelector);
        if (!contentElement) return;

        // H2, H3 태그만 추출
        const headings = contentElement.querySelectorAll('h2, h3');
        const tocItems: TOCItem[] = [];

        headings.forEach((heading, index) => {
            const level = parseInt(heading.tagName.substring(1));
            const text = heading.textContent || '';
            let id = heading.id;

            // ID가 없으면 생성
            if (!id) {
                id = `heading-${index}`;
                heading.id = id;
            }

            tocItems.push({ id, text, level });
        });

        setToc(tocItems);

        // Intersection Observer로 현재 위치 추적
        const observerOptions = {
            rootMargin: '-80px 0px -80% 0px',
            threshold: 0
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    setActiveId(entry.target.id);
                }
            });
        }, observerOptions);

        headings.forEach((heading) => {
            observer.observe(heading);
        });

        return () => {
            headings.forEach((heading) => {
                observer.unobserve(heading);
            });
        };
    }, [contentSelector]);

    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
        e.preventDefault();
        const element = document.getElementById(id);
        if (element) {
            const offset = 80; // 헤더 높이
            const elementPosition = element.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - offset;

            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    };

    if (toc.length === 0) return null;

    return (
        <nav className="toc-container">
            <div className="toc-header">
                <svg className="toc-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7" />
                </svg>
                <h3>목차</h3>
            </div>
            <ul className="toc-list">
                {toc.map((item) => (
                    <li
                        key={item.id}
                        className={`toc-item toc-level-${item.level} ${activeId === item.id ? 'toc-active' : ''}`}
                    >
                        <a
                            href={`#${item.id}`}
                            onClick={(e) => handleClick(e, item.id)}
                            className="toc-link"
                        >
                            {item.text}
                        </a>
                    </li>
                ))}
            </ul>
        </nav>
    );
};

export default TableOfContents;
