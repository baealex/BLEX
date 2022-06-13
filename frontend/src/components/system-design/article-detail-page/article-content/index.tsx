import classNames from 'classnames/bind';
import styles from './ArticleContent.module.scss';
const cn = classNames.bind(styles);

import Router from 'next/router';
import { useEffect } from 'react';


export interface ArticleContentProps {
    html: string;
    isEdit?: boolean;
    noMargin?: boolean;
}

export function ArticleContent({
    html,
    isEdit,
    noMargin
}: ArticleContentProps) {
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const handleClickAnchorTag = (e: any) => {
                if (e.target.nodeName === 'A') {
                    const { href } = e.target;
                    const isSameOrigin = href.includes(`${location.protocol}//${location.host}/`);

                    if (!isEdit && isSameOrigin) {
                        e.preventDefault();
                        Router.push(href).then(() => window.scrollTo(0, 0));
                        return;
                    }

                    e.preventDefault();
                    window.open(href, '_blank');
                    return;
                }
            };

            const $article = document.querySelector(`.${styles.article}`);

            $article?.addEventListener('click', handleClickAnchorTag);

            return () => {
                $article?.removeEventListener('click', handleClickAnchorTag);
            };
        }
    }, []);

    return (
        <div
            className={cn('article', { noMargin })}
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}
