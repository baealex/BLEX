import classNames from 'classnames/bind';
import styles from './ArticleContent.module.scss';
const cn = classNames.bind(styles);

import React from 'react';
import Router from 'next/router';

export interface ArticleContentProps {
    html: string;
}

export function ArticleContent({
    html
}: ArticleContentProps) {
    const handleClickContent = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target instanceof HTMLAnchorElement) {
            const { href } = e.target as HTMLAnchorElement;
            const isSameOrigin = href.includes(`${location.protocol}//${location.host}/`);

            if (isSameOrigin) {
                e.preventDefault();
                Router.push(href).then(() => window.scrollTo(0, 0));
                return;
            }

            e.preventDefault();
            window.open(href, '_blank');
            return;
        }
    };

    return (
        <div
            className={cn('article')}
            onClick={handleClickContent}
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}
